import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  colors,
  Label,
  Muted,
  Screen,
  Spinner,
  TextField,
  Title,
} from '@/components/ui';
import {
  courtNetCents,
  formatBRDate,
  formatBRL,
  isValidTime,
  parseBRLToCents,
  shortTime,
} from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { AvailabilityRule, Court, CourtSlot, WEEKDAY_SHORT } from '@/lib/types';
import { usePlatformCommissionBps } from '@/lib/usePlatformCommission';

export default function QuadraDetalhe() {
  const { courtId } = useLocalSearchParams<{ courtId: string }>();
  const commissionBps = usePlatformCommissionBps();

  const [court, setCourt] = useState<Court | null>(null);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [slots, setSlots] = useState<CourtSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  // formulário de nova regra recorrente
  const [weekday, setWeekday] = useState(2);
  const [start, setStart] = useState('20:00');
  const [end, setEnd] = useState('21:00');
  const [price, setPrice] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('12');
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!courtId) return;
    const today = new Date().toISOString().slice(0, 10);
    const [c, r, s] = await Promise.all([
      supabase.from('courts').select('*').eq('id', courtId).maybeSingle(),
      supabase.from('court_availability_rules').select('*').eq('court_id', courtId).order('weekday').order('start_time'),
      supabase
        .from('court_slots')
        .select('*')
        .eq('court_id', courtId)
        .gte('slot_date', today)
        .order('slot_date')
        .order('start_time')
        .limit(60),
    ]);
    setCourt((c.data as Court | null) ?? null);
    setRules((r.data ?? []) as AvailabilityRule[]);
    setSlots((s.data ?? []) as CourtSlot[]);
    setLoading(false);
  }, [courtId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const priceCents = parseBRLToCents(price);
  const netPreview =
    court && priceCents !== null ? courtNetCents(priceCents, court.commission_mode, commissionBps) : null;

  async function addRule() {
    setMessage(null);
    const players = Number(maxPlayers);
    if (!isValidTime(start) || !isValidTime(end)) return setMessage({ kind: 'error', text: 'Use horários no formato HH:MM.' });
    if (end <= start) return setMessage({ kind: 'error', text: 'O término deve ser depois do início.' });
    if (priceCents === null) return setMessage({ kind: 'error', text: 'Informe o valor do horário (ex.: 150,00).' });
    if (!Number.isInteger(players) || players <= 0) return setMessage({ kind: 'error', text: 'Máximo de jogadores inválido.' });

    setAdding(true);
    const { error } = await supabase.from('court_availability_rules').insert({
      court_id: courtId,
      weekday,
      start_time: start,
      end_time: end,
      price_cents: priceCents,
      max_players: players,
    });
    setAdding(false);
    if (error) return setMessage({ kind: 'error', text: 'Não foi possível salvar a regra.' });
    setMessage({ kind: 'info', text: 'Regra salva. Gere os horários para liberar as datas.' });
    load();
  }

  async function removeRule(id: string) {
    await supabase.from('court_availability_rules').update({ active: false }).eq('id', id);
    load();
  }

  async function generate() {
    setMessage(null);
    setGenerating(true);
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 30);
    const { data, error } = await supabase.rpc('generate_slots_from_rules', {
      _court: courtId,
      _from: from.toISOString().slice(0, 10),
      _to: to.toISOString().slice(0, 10),
    });
    setGenerating(false);
    if (error) return setMessage({ kind: 'error', text: 'Não foi possível gerar os horários.' });
    setMessage({ kind: 'info', text: `${data ?? 0} horário(s) criado(s) para os próximos 30 dias.` });
    load();
  }

  async function toggleSlot(slot: CourtSlot) {
    const next = slot.status === 'open' ? 'closed' : 'open';
    await supabase.from('court_slots').update({ status: next }).eq('id', slot.id);
    load();
  }

  if (loading) return <Spinner />;
  if (!court) {
    return (
      <Screen>
        <Banner>Quadra não encontrada.</Banner>
      </Screen>
    );
  }

  const activeRules = rules.filter((r) => r.active);

  return (
    <Screen>
      <Title>{court.name}</Title>
      <Muted>
        {court.sport} · até {court.capacity} jogadores · acréscimo fora do app {court.offline_surcharge_bps / 100}%
      </Muted>
      <View style={{ height: 12 }} />
      {message && <Banner kind={message.kind}>{message.text}</Banner>}

      <Card>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 8 }}>
          Horários recorrentes
        </Text>
        {activeRules.length === 0 && <Muted>Nenhuma regra ainda. Ex.: toda terça às 20h.</Muted>}
        {activeRules.map((r) => (
          <View
            key={r.id}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}
          >
            <Text style={{ color: colors.text, flex: 1 }}>
              {WEEKDAY_SHORT[r.weekday]} · {shortTime(r.start_time)}–{shortTime(r.end_time)} · {formatBRL(r.price_cents)}
            </Text>
            <Pressable onPress={() => removeRule(r.id)}>
              <Text style={{ color: colors.danger, fontWeight: '700' }}>Remover</Text>
            </Pressable>
          </View>
        ))}

        <View style={{ height: 12 }} />
        <Label>Dia da semana</Label>
        <ChipRow>
          {WEEKDAY_SHORT.map((d, i) => (
            <Chip key={d} label={d} selected={weekday === i} onPress={() => setWeekday(i)} />
          ))}
        </ChipRow>
        <TextField label="Início (HH:MM)" value={start} onChangeText={setStart} maxLength={5} />
        <TextField label="Término (HH:MM)" value={end} onChangeText={setEnd} maxLength={5} />
        <TextField
          label="Valor do horário (R$)"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder="150,00"
        />
        {netPreview !== null && (
          <Banner kind="info">
            Pagando pelo app, você recebe {formatBRL(netPreview)} (antes da taxa do gateway de pagamento).
          </Banner>
        )}
        <TextField label="Máximo de jogadores" value={maxPlayers} onChangeText={setMaxPlayers} keyboardType="number-pad" />
        <Button title="Salvar regra" onPress={addRule} loading={adding} />
        <Button title="Gerar horários dos próximos 30 dias" variant="secondary" onPress={generate} loading={generating} />
      </Card>

      <Card>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 8 }}>Próximos horários</Text>
        {slots.length === 0 && <Muted>Nenhum horário gerado.</Muted>}
        {slots.map((s) => {
          const dow = new Date(`${s.slot_date}T12:00:00`).getDay();
          const canToggle = s.status === 'open' || s.status === 'closed';
          return (
            <View
              key={s.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  {WEEKDAY_SHORT[dow]} {formatBRDate(s.slot_date)} · {shortTime(s.start_time)}–{shortTime(s.end_time)}
                </Text>
                <Muted>
                  {formatBRL(s.price_cents)} ·{' '}
                  {s.status === 'open' ? 'Aberto' : s.status === 'booked' ? 'Reservado' : s.status === 'closed' ? 'Fechado' : 'Cancelado'}
                </Muted>
              </View>
              {canToggle && (
                <Pressable onPress={() => toggleSlot(s)}>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>{s.status === 'open' ? 'Fechar' : 'Reabrir'}</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
