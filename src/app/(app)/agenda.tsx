import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Badge, Banner, Button, Card, colors, Muted, Screen, Spinner, Subtitle, Title } from '@/components/ui';
import { formatSlotWhen } from '@/lib/format';
import { OwnerMatch } from '@/lib/ownerData';
import { useOwnerAgenda } from '@/lib/useOwnerAgenda';
import { WEEKDAY_SHORT } from '@/lib/types';

function MatchCard({ m, onPress }: { m: OwnerMatch; onPress: () => void }) {
  const total = m.lineSlots + m.goalkeeperSlots;
  const taken = m.rows.length;
  return (
    <Pressable onPress={onPress}>
      <Card>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{m.title || 'Partida'}</Text>
        <Muted>{m.courtName}</Muted>
        <Muted>
          {formatSlotWhen(m.slotDate, m.startTime, WEEKDAY_SHORT)}–{m.endTime.slice(0, 5)}
        </Muted>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Badge label={`${taken}/${total} vagas`} tone={taken >= total ? 'success' : 'info'} />
          <Badge label={`${m.paidCount} pago${m.paidCount === 1 ? '' : 's'}`} tone="success" />
          <Badge label={`${m.pendingCount} pendente${m.pendingCount === 1 ? '' : 's'}`} tone={m.pendingCount > 0 ? 'warn' : 'neutral'} />
        </View>
        <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 10 }}>Abrir partida →</Text>
      </Card>
    </Pressable>
  );
}

export default function Agenda() {
  const router = useRouter();
  const { data, loading, error } = useOwnerAgenda();

  if (loading) return <Spinner />;

  if (data && !data.institutionId) {
    return (
      <Screen>
        <Title>Agenda da quadra</Title>
        <Card>
          <Text style={{ fontWeight: '800', color: colors.text }}>Cadastre sua instituição</Text>
          <Muted>Depois você libera os horários e acompanha as reservas por aqui.</Muted>
          <View style={{ height: 8 }} />
          <Button title="Cadastrar instituição" onPress={() => router.push('/quadra')} />
        </Card>
      </Screen>
    );
  }

  const matches = data?.matches ?? [];
  const pending = matches.reduce((n, m) => n + m.pendingCount, 0);
  const paid = matches.reduce((n, m) => n + m.paidCount, 0);

  return (
    <Screen>
      <Title>Agenda da quadra</Title>
      <Subtitle>{data?.institutionName}</Subtitle>
      {error && <Banner>Não foi possível carregar as reservas. Verifique a conexão e tente de novo.</Banner>}

      <Card>
        <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 6 }}>Próximas partidas</Text>
        <Muted>
          {matches.length} partida{matches.length === 1 ? '' : 's'} · {paid} pagamento{paid === 1 ? '' : 's'} confirmado{paid === 1 ? '' : 's'} · {pending} pendente{pending === 1 ? '' : 's'}
        </Muted>
        <View style={{ height: 8 }} />
        <Button title="Ver quem pagou e quem não pagou" variant="secondary" onPress={() => router.push('/pagamentos')} />
        <Button title="Gerenciar horários e quadras" variant="secondary" onPress={() => router.push('/quadra')} />
      </Card>

      {matches.length === 0 ? (
        <Card>
          <Muted>Nenhuma partida marcada nas suas quadras ainda. Quando um organizador reservar um horário, ele aparece aqui.</Muted>
        </Card>
      ) : (
        matches.map((m) => <MatchCard key={m.id} m={m} onPress={() => router.push(`/partidas/${m.id}`)} />)
      )}
    </Screen>
  );
}
