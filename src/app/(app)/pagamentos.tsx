import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Badge, Banner, Button, Card, Chip, ChipRow, colors, Muted, Screen, Spinner, Subtitle, Title } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { formatBRL, formatSlotWhen } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useOwnerAgenda } from '@/lib/useOwnerAgenda';
import { KIND_LABEL, WEEKDAY_SHORT } from '@/lib/types';

type Filter = 'pending' | 'paid' | 'all';

export default function Pagamentos() {
  const router = useRouter();
  const { data, loading, error, reload } = useOwnerAgenda();
  const [filter, setFilter] = useState<Filter>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  async function markPaid(participantId: string, name: string) {
    const yes = await confirmAction(`Confirmar que ${name} pagou na quadra?`, 'Confirmar');
    if (!yes) return;
    setBusyId(participantId);
    setMessage(null);
    const { error: err } = await supabase.rpc('confirm_manual_payment', { _participant: participantId });
    setBusyId(null);
    if (err) return setMessage({ kind: 'error', text: err.message });
    setMessage({ kind: 'info', text: 'Pagamento registrado.' });
    reload();
  }

  if (loading) return <Spinner />;

  if (data && !data.institutionId) {
    return (
      <Screen>
        <Title>Pagamentos</Title>
        <Card>
          <Muted>Cadastre sua instituição para acompanhar os pagamentos.</Muted>
          <View style={{ height: 8 }} />
          <Button title="Cadastrar instituição" onPress={() => router.push('/quadra')} />
        </Card>
      </Screen>
    );
  }

  const matches = data?.matches ?? [];
  const pending = matches.reduce((n, m) => n + m.pendingCount, 0);
  const paid = matches.reduce((n, m) => n + m.paidCount, 0);
  const money = data?.money ?? null;

  return (
    <Screen>
      <Title>Pagamentos</Title>
      <Subtitle>Quem já pagou e quem ainda não pagou nas próximas partidas.</Subtitle>
      {error && <Banner>Não foi possível carregar os pagamentos. Verifique a conexão e tente de novo.</Banner>}
      {message && <Banner kind={message.kind}>{message.text}</Banner>}

      <Card>
        <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 6 }}>Resumo</Text>
        <Muted>
          {paid} pago{paid === 1 ? '' : 's'} · {pending} pendente{pending === 1 ? '' : 's'}
        </Muted>
        {money && (
          <>
            <Muted>Recebido pelo app: {formatBRL(money.appCents)}</Muted>
            <Muted>Recebido na quadra (manual): {formatBRL(money.manualCents)}</Muted>
            <Muted>Comissão da plataforma: {formatBRL(money.commissionCents)}</Muted>
          </>
        )}
      </Card>

      <ChipRow>
        <Chip label={`Pendentes (${pending})`} selected={filter === 'pending'} onPress={() => setFilter('pending')} />
        <Chip label={`Pagos (${paid})`} selected={filter === 'paid'} onPress={() => setFilter('paid')} />
        <Chip label="Todos" selected={filter === 'all'} onPress={() => setFilter('all')} />
      </ChipRow>

      {matches.length === 0 && (
        <Card>
          <Muted>Nenhuma partida marcada nas suas quadras ainda.</Muted>
        </Card>
      )}

      {matches.map((m) => {
        const rows = m.rows.filter((r) => (filter === 'all' ? true : filter === 'paid' ? r.paid : !r.paid));
        if (rows.length === 0) return null;
        return (
          <Card key={m.id}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{m.title || 'Partida'}</Text>
            <Muted>
              {m.courtName} · {formatSlotWhen(m.slotDate, m.startTime, WEEKDAY_SHORT)}
            </Muted>
            <View style={{ height: 6 }} />
            {rows.map((r) => (
              <View key={r.participantId} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ flex: 1, color: colors.text, fontWeight: '700' }}>
                    {r.name}
                    {r.isOrganizer ? ' (organizador)' : ''} · {KIND_LABEL[r.kind]}
                  </Text>
                  {r.paid ? (
                    <Badge label={r.paidSource === 'manual' ? 'Pago na quadra' : 'Pago pelo app'} tone="success" />
                  ) : (
                    <Badge label="Pendente" tone="warn" />
                  )}
                </View>
                {!r.paid && m.acceptsManual && (
                  <Button
                    title="Marcar como pago (na quadra)"
                    variant="secondary"
                    loading={busyId === r.participantId}
                    onPress={() => markPaid(r.participantId, r.name)}
                  />
                )}
              </View>
            ))}
            <Button title="Abrir partida" variant="secondary" onPress={() => router.push(`/partidas/${m.id}`)} />
          </Card>
        );
      })}
    </Screen>
  );
}
