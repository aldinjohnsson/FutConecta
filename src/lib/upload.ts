import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

/**
 * Abre a galeria, envia a imagem para o bucket público "media" e devolve a URL pública.
 * folder: "banners" (só admin) ou "covers/<id-do-usuario>" (dono da quadra).
 * Retorna null se a pessoa cancelar. Lança erro com mensagem amigável se falhar.
 */
export async function pickAndUploadImage(folder: string, aspect: [number, number] = [16, 9]): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const ext = (asset.mimeType?.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
  const path = `${folder}/${Date.now()}.${ext}`;

  const body = await (await fetch(asset.uri)).arrayBuffer();
  const { error } = await supabase.storage.from('media').upload(path, body, {
    contentType: asset.mimeType ?? 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error('Não foi possível enviar a imagem. Confira se a migration 0004 foi aplicada.');

  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}
