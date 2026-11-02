import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { Badge, Banner, Button, Card, Chip, ChipRow, colors, Muted, Screen, SectionHeader, Spinner, TextField, Title } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';
import { pickAndUploadImage } from '@/lib/upload';
import { useAuth } from '@/providers/AuthProvider';

interface BannerRow {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  active: boolean;
  sort_order: number;
}

export default function AdminBanners() {
  const { roles, session } = useAuth();
  const isAdmin = roles.includes('admin');
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('banners').select('id,title,image_url,link_url,active,sort_order').order('sort_order').order('created_at', { ascending: false });
    setBanners((data ?? []) as BannerRow[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) load();
      else setLoading(false);
    }, [isAdmin, load]),
  );

  if (loading) return <Spinner />;
  if (!isAdmin) {
    return (
      <Screen>
        <Banner>Acesso restrito ao administrador.</Banner>
      </Screen>
    );
  }

  async function upload() {
    setMessage(null);
    setBusy(true);
    try {
      const url = await pickAndUploadImage('banners', [21, 9]);
      if (url) setImageUrl(url);
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message });
    }
    setBusy(false);
  }

  async function add() {
    setMessage(null);
    if (!imageUrl.trim()) return setMessage({ kind: 'error', text: 'Escolha uma imagem ou cole o endereço dela.' });
    const l = link.trim();
    if (l && !/^https?:\/\//i.test(l)) return setMessage({ kind: 'error', text: 'O link precisa começar com http:// ou https://' });
    setBusy(true);
    const { error } = await supabase.from('banners').insert({
      title: title.trim() || null,
      image_url: imageUrl.trim(),
      link_url: l || null,
      created_by: session?.user.id,
      sort_order: banners.length,
    });
    setBusy(false);
    if (error) return setMessage({ kind: 'error', text: 'Não foi possível salvar. Confira se a migration 0004 foi aplicada.' });
    setTitle('');
    setLink('');
    setImageUrl('');
    setMessage({ kind: 'info', text: 'Banner publicado.' });
    load();
  }

  async function toggle(b: BannerRow) {
    await supabase.from('banners').update({ active: !b.active }).eq('id', b.id);
    load();
  }

  async function remove(b: BannerRow) {
    if (!(await confirmAction('Excluir este banner?', 'Excluir'))) return;
    await supabase.from('banners').delete().eq('id', b.id);
    load();
  }

  return (
    <Screen>
      <Title>Banners</Title>
      <Muted>Aparecem no topo da tela inicial de todos os jogadores. Tamanho ideal: 1260×540.</Muted>

      <SectionHeader title="Novo banner" />
      <Card>
        <TextField label="Título (opcional)" value={title} onChangeText={setTitle} />
        <TextField label="Link ao tocar (opcional)" value={link} onChangeText={setLink} autoCapitalize="none" placeholder="https://..." />
        {imageUrl ? <Image source={{ uri: imageUrl }} style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 10 }} resizeMode="cover" /> : null}
        <Button title={imageUrl ? 'Trocar imagem' : 'Escolher imagem'} variant="secondary" onPress={upload} loading={busy} />
        <TextField label="…ou cole o endereço da imagem" value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" placeholder="https://..." />
        {message && <Banner kind={message.kind}>{message.text}</Banner>}
        <Button title="Publicar banner" onPress={add} loading={busy} />
      </Card>

      <SectionHeader title={`Banners (${banners.length})`} />
      {banners.length === 0 && (
        <Card>
          <Muted>Nenhum banner cadastrado.</Muted>
        </Card>
      )}
      {banners.map((b) => (
        <Card key={b.id}>
          <Image source={{ uri: b.image_url }} style={{ width: '100%', height: 110, borderRadius: 12, backgroundColor: colors.primarySoft }} resizeMode="cover" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <Text style={{ fontWeight: '700', color: colors.text, flex: 1 }} numberOfLines={1}>
              {b.title || 'Sem título'}
            </Text>
            <Badge label={b.active ? 'Ativo' : 'Pausado'} tone={b.active ? 'success' : 'neutral'} />
          </View>
          <ChipRow>
            <Chip label={b.active ? 'Pausar' : 'Ativar'} onPress={() => toggle(b)} />
            <Chip label="Excluir" onPress={() => remove(b)} />
          </ChipRow>
        </Card>
      ))}
    </Screen>
  );
}
