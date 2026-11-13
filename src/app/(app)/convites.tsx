import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Badge, Banner, Button, Card, colors, Muted, Screen, Spinner, Subtitle, Title } from '@/components/ui';
import { formatSlotWhen } from '@/lib/format';
import { inviteErrorText, loadMyInvitations, loadMyNotices, markNoticesRead, MatchNotice, ReceivedInvitation, respondInvitation } from '@/lib/invites';
import { KIND_LABEL, WEEKDAY_SHORT } from '@/lib/types';

export default function Convites() {
  const router = useRouter();
  const [list, setList] = useState<ReceivedInvitation[]>([]);
  const [notices, setNotices] = useState<MatchNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    loadMyNotices().then((n) => {
      setNotices(n);
      if (n.length) markNoticesRead(); // visto: some do contador, mas fica listado até sair da tela
    });
    try {
      setList(await loadMyInvitations());
    } catch (e) {
      setError(inviteErrorText((e as { message?: string }).message ?? ''));
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function answer(inv: ReceivedInvitation, accept: boolean) {
    setBusyId(inv.id);
    setError(null);
    setNotice(null);
    const { error: err } = await respondInvitation(inv.id, accept);
    setBusyId(null);
    if (err) {
      setError(inviteErrorText(err.message));
      return load(); // o convite pode ter sido cancelado ou a partida lotado
    }
    if (accept) {
      // a vaga fica reservada: o jogador conclui o pagamento na tela da partida
      router.push(`/partidas/${inv.matchId}`);
      return;
    }
    setNotice('Convite recusado.');
    load();
  }

  if (loading) return <Spinner />;

  return (
    <Screen>
      <Title>Convites</Title>
      <Subtitle>Organizadores que chamaram você para jogar.</Subtitle>
      {notices.map((n) => (
        <Card key={n.id}>
          <Text style={{ fontWeight: '800', color: colors.text }}>🔔 Aviso</Text>
          <Muted>{n.message}</Muted>
          <Button title="Ver partida" variant="secondary" onPress={() => router.push(`/partidas/${n.matchId}`)} />
        </Card>
      ))}
      {error && <Banner>{error}</Banner>}
      {notice && <Banner kind="info">{notice}</Banner>}

      {list.length === 0 ? (
        <Card>
          <Text style={{ fontWeight: '800', color: colors.text }}>Nenhum convite no momento</Text>
          <Muted>Deixe o botão "Estou disponível para jogo" ligado para organizadores encontrarem você.</Muted>
        </Card>
      ) : (
        list.map((inv) => (
          <Card key={inv.id}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{inv.title || 'Partida'}</Text>
            <Muted>
              {inv.inviterName ? `${inv.inviterName} convidou você` : 'Você foi convidado'} · vaga de {KIND_LABEL[inv.kind].toLowerCase()}
            </Muted>
            <View style={{ height: 6 }} />
            <Muted>
              {inv.institutionName} · {inv.courtName}
            </Muted>
            <Muted>
              {formatSlotWhen(inv.slotDate, inv.startTime, WEEKDAY_SHORT)}–{inv.endTime.slice(0, 5)}
            </Muted>
            <View style={{ marginTop: 8 }}>
              <Badge label="Aguardando sua resposta" tone="warn" />
            </View>
            <View style={{ height: 8 }} />
            <Button title="Aceitar e entrar na partida" loading={busyId === inv.id} onPress={() => answer(inv, true)} />
            <Button title="Recusar" variant="secondary" disabled={busyId === inv.id} onPress={() => answer(inv, false)} />
          </Card>
        ))
      )}
    </Screen>
  );
}
