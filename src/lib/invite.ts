import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

const KEY = 'pending_invite_match';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isMatchId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/**
 * Link de convite da partida.
 * Em produção, defina EXPO_PUBLIC_APP_URL (ex.: https://app.seudominio.com.br) para que o link
 * seja clicável no WhatsApp também quando o convite sai do app nativo.
 * Na web, sem a variável, usa o endereço em que o app está aberto.
 */
export function inviteUrl(matchId: string): string {
  const base = process.env.EXPO_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (base) return `${base}/convite/${matchId}`;
  return Linking.createURL(`/convite/${matchId}`);
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Guarda a partida do convite enquanto a pessoa cria a conta ou entra. */
export async function savePendingInvite(matchId: string): Promise<void> {
  if (!isMatchId(matchId)) return;
  try {
    await AsyncStorage.setItem(KEY, matchId);
  } catch {
    // sem armazenamento: o convite simplesmente não é retomado após o login
  }
}

/** Lê e apaga o convite pendente (uso único). */
export async function takePendingInvite(): Promise<string | null> {
  try {
    const id = await AsyncStorage.getItem(KEY);
    if (!id) return null;
    await AsyncStorage.removeItem(KEY);
    return isMatchId(id) ? id : null;
  } catch {
    return null;
  }
}
