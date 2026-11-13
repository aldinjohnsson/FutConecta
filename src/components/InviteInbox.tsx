import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Badge, Banner, Button, colors, Muted } from '@/components/ui';
import { formatSlotWhen } from '@/lib/format';
import { inviteErrorText, loadMyInvitations, notifyInvitesChanged, ReceivedInvitation, respondInvitation } from '@/lib/invites';
import { KIND_LABEL, WEEKDAY_SHORT } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

const seenKey = (userId: string) => `seen_invites:${userId}`;
const POLL_MS = 30_000;

/**
 * Mensagem dentro do app para convites novos. Aparece uma vez por convite: a pessoa aceita, recusa
 * ou decide depois (o convite continua em Convites e no sino do Início). Consulta a cada 30 s.
 */
export default function InviteInbox() {
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const userId = session?.user.id ?? null;

  const [list, setList] = useState<ReceivedInvitation[]>([]);
  const [seen, setSeen] = useState<string[] | null>(null); // null = ainda não leu o que já foi visto
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSignature = useRef('');

  // convites que a pessoa já viu (decidiu depois) neste aparelho
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(seenKey(userId))
      .then((raw) => {
        try {
          setSeen(raw ? (JSON.parse(raw) as string[]) : []);
        } catch {
          setSeen([]);
        }
      })
      .catch(() => setSeen([]));
  }, [userId]);

  const refresh = useCallback(async () => {
    try {
      const l = await loadMyInvitations();
      setList(l);
      const signature = l.map((i) => i.id).join(',');
      if (signature !== lastSignature.current) {
        lastSignature.current = signature;
        notifyInvitesChanged(); // atualiza o contador do sino
      }
    } catch {
      // recurso ainda não disponível no banco: não mostra nada
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [userId, refresh]);

  const current = seen === null || pathname === '/convites' ? null : (list.find((i) => !seen.includes(i.id)) ?? null);

  function markSeen(id: string) {
    setSeen((prev) => {
      const next = [...(prev ?? []), id].slice(-100);
      if (userId) AsyncStorage.setItem(seenKey(userId), JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  async function answer(accept: boolean) {
    if (!current) return;
    setBusy(accept ? 'accept' : 'decline');
    setError(null);
    const { error: err } = await respondInvitation(current.id, accept);
    setBusy(null);
    if (err) {
      setError(inviteErrorText(err.message));
      return refresh(); // o convite pode ter sido cancelado ou a partida lotado
    }
    markSeen(current.id);
    if (accept) router.push(`/partidas/${current.matchId}`);
    else refresh();
  }

  function later() {
    if (current) markSeen(current.id);
    setError(null);
  }

  return (
    <Modal visible={current !== null} transparent animationType="fade" onRequestClose={later}>
      <Pressable
        onPress={later}
        style={{ flex: 1, backgroundColor: 'rgba(8,22,15,0.65)', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 440, backgroundColor: colors.card, borderRadius: 26, overflow: 'hidden' }}>
          <View style={{ backgroundColor: colors.navy, padding: 20 }}>
            <Text style={{ fontSize: 30 }}>✉️</Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 6 }}>Você foi convidado para jogar</Text>
            <Text style={{ color: '#B7E4C7', marginTop: 4 }}>
              {current?.inviterName ? `${current.inviterName} chamou você` : 'Um organizador chamou você'}
            </Text>
          </View>

          <View style={{ padding: 18 }}>
            {error && <Banner>{error}</Banner>}
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{current?.title || 'Partida'}</Text>
            <Muted>
              {current?.institutionName} · {current?.courtName}
            </Muted>
            {current && (
              <Text style={{ color: colors.text, fontWeight: '700', marginTop: 6 }}>
                📅 {formatSlotWhen(current.slotDate, current.startTime, WEEKDAY_SHORT)}–{current.endTime.slice(0, 5)}
              </Text>
            )}
            {current && (
              <View style={{ marginTop: 10 }}>
                <Badge label={`Vaga de ${KIND_LABEL[current.kind].toLowerCase()}`} tone="info" />
              </View>
            )}
            <View style={{ height: 14 }} />
            <Button title="Aceitar e entrar na partida" loading={busy === 'accept'} disabled={busy !== null} onPress={() => answer(true)} />
            <Button title="Recusar" variant="secondary" loading={busy === 'decline'} disabled={busy !== null} onPress={() => answer(false)} />
            <Pressable onPress={later} disabled={busy !== null} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: colors.muted, fontWeight: '700' }}>Decidir depois</Text>
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>
              Você pode ver e responder depois em Mais → Convites recebidos.
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
