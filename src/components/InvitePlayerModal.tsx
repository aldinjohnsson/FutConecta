import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Badge, Banner, Button, colors, Label, Muted, Spinner } from '@/components/ui';
import { formatSlotWhen } from '@/lib/format';
import { InviteStatus, inviteErrorText, invitePlayer, loadManageableMatches, loadMatchInvitationStatuses, ManageableMatch } from '@/lib/invites';
import { AvailablePlayer } from '@/lib/players';
import { SlotKind, WEEKDAY_SHORT } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

const STATUS_TEXT: Record<InviteStatus, string> = {
  pending: 'Convite já enviado. Aguardando a resposta.',
  accepted: 'Este jogador já aceitou o convite desta partida.',
  declined: 'Este jogador recusou um convite anterior desta partida. Você pode convidar de novo.',
  cancelled: '',
};

/** Janela para convidar um jogador disponível para uma das partidas que a pessoa organiza. */
export default function InvitePlayerModal({
  player,
  onClose,
  onSent,
}: {
  player: AvailablePlayer | null;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const router = useRouter();
  const { session } = useAuth();
  const [matches, setMatches] = useState<ManageableMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const kind: SlotKind = 'line'; // goleiro não entra no racha
  const [status, setStatus] = useState<InviteStatus | null>(null);
  const [sending, setSending] = useState(false);

  // ao abrir para um jogador: carrega as partidas que a pessoa pode gerenciar
  useEffect(() => {
    if (!player || !session) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setMatchId(null);
    setStatus(null);
    loadManageableMatches(session.user.id)
      .then((list) => {
        if (!alive) return;
        setMatches(list);
        if (list.length === 1) setMatchId(list[0].id);
      })
      .catch(() => alive && setError('Não foi possível carregar suas partidas.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [player, session]);

  const match = matches.find((m) => m.id === matchId) ?? null;

  // situação do convite deste jogador nesta partida
  useEffect(() => {
    if (!matchId || !player) return setStatus(null);
    let alive = true;
    loadMatchInvitationStatuses(matchId)
      .then((s) => alive && setStatus(s[player.id] ?? null))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, [matchId, player]);

  const freeOf = (_k: SlotKind) => (match ? match.lineFree : 0);
  const noSeats = match !== null && match.lineFree === 0;
  const blocked = status === 'pending' || status === 'accepted';

  async function send() {
    if (!player || !match) return;
    setSending(true);
    setError(null);
    const { error: err } = await invitePlayer(match.id, player.id, kind);
    setSending(false);
    if (err) return setError(inviteErrorText(err.message));
    onSent(`Convite enviado para ${player.fullName}. Quando ele aceitar, entra na sua partida.`);
    onClose();
  }

  return (
    <Modal visible={player !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(8,22,15,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
        {/* o toque dentro do cartão não fecha a janela */}
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 520, maxHeight: '88%', backgroundColor: colors.card, borderRadius: 22, padding: 18 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Convidar {player?.fullName.split(' ')[0]}</Text>
            <Muted>Escolha a partida. Ele recebe o convite e entra quando aceitar.</Muted>
            <View style={{ height: 12 }} />

            {error && <Banner>{error}</Banner>}

            {loading ? (
              <Spinner />
            ) : matches.length === 0 ? (
              <View>
                <Banner kind="warn">Você não tem partidas futuras para convidar. Reserve um horário e crie uma partida primeiro.</Banner>
                <Button
                  title="Ver quadras"
                  onPress={() => {
                    onClose();
                    router.push('/explorar');
                  }}
                />
              </View>
            ) : (
              <>
                <Label>Partida</Label>
                {matches.map((m) => {
                  const selected = m.id === matchId;
                  const full = m.lineFree === 0;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setMatchId(m.id)}
                      style={{
                        borderWidth: 2,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primarySoft : '#fff',
                        borderRadius: 14,
                        padding: 12,
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ fontWeight: '800', color: colors.text }}>{m.title || 'Partida'}</Text>
                      <Muted>
                        {m.courtName} · {formatSlotWhen(m.slotDate, m.startTime, WEEKDAY_SHORT)}
                      </Muted>
                      <View style={{ marginTop: 6 }}>
                        <Badge
                          label={full ? 'Sem vagas' : `Vagas livres: ${m.lineFree}`}
                          tone={full ? 'neutral' : 'success'}
                        />
                      </View>
                    </Pressable>
                  );
                })}

                {noSeats && <Banner kind="warn">Esta partida não tem vagas livres.</Banner>}
                {status && STATUS_TEXT[status] ? <Banner kind={blocked ? 'info' : 'warn'}>{STATUS_TEXT[status]}</Banner> : null}
              </>
            )}

            <View style={{ height: 6 }} />
            {matches.length > 0 && (
              <Button title="Enviar convite" onPress={send} loading={sending} disabled={!match || noSeats || blocked || freeOf(kind) === 0} />
            )}
            <Button title="Cancelar" variant="secondary" onPress={onClose} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
