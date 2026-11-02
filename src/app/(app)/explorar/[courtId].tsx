import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import Calendar from '@/components/Calendar';
import { Badge, Banner, Button, Card, colors, Muted, Screen, SectionHeader, Spinner } from '@/components/ui';
import { toISODate } from '@/lib/courts';
import { formatBRL, shortTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { WEEKDAY_SHORT } from '@/lib/types';

interface CourtInfo {
  id: string;
  name: string;
  sport: string;
  capacity: number;
  rules: string | null;
  free_cancel_hours: number;
  institutions: { name: string; city: string; address: string | null; photo_url: string | null; phone: string | null } | null;
}
interface SlotRow {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  price_cents: number;
  max_players: number;
  status: string;
  organizer_booking: boolean;
}
interface DayMatch {
  id: string;
  title: string | null;
  line_slots: number;
  goalkeeper_slots: number;
  line_price_cents: number;
  court_slots: { slot_date: string; start_time: string; end_time: string } | null;
}

function monthRange(d: Date): [string, string] {
  return [toISODate(new Date(d.getFullYear(), d.getMonth(), 1)), toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
}

export default function QuadraDetalhe() {
  const router = useRouter();
  const { courtId } = useLocalSearchParams<{ courtId: string }>();
  const [court, setCourt] = useState<CourtInfo | null>(null);
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(toISODate(new Date()));
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [matches, setMatches] = useState<DayMatch[]>([]);
  const [taken, setTaken] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!courtId) return;
    supabase
      .from('courts')
      .select('id,name,sport,capacity,rules,free_cancel_hours,institutions(name,city,address,photo_url,phone)')
      .eq('id', courtId)
      .maybeSingle()
      .then(({ data }) => setCourt((data as unknown as CourtInfo | null) ?? null));
  }, [courtId]);

  const loadMonth = useCallback(async () => {
    if (!courtId) return;
    const [from, to] = monthRange(month);
    const [s, m] = await Promise.all([
      supabase
        .from('court_slots')
        .select('id,slot_date,start_time,end_time,price_cents,max_players,status,organizer_booking')
        .eq('court_id', courtId)
        .gte('slot_date', from)
        .lte('slot_date', to)
        .order('slot_date')
        .order('start_time'),
      supabase
        .from('matches')
        .select('id,title,line_slots,goalkeeper_slots,line_price_cents,court_slots!inner(slot_date,start_time,end_time)')
        .eq('court_id', courtId)
        .eq('status', 'scheduled')
        .gte('court_slots.slot_date', from)
        .lte('court_slots.slot_date', to),
    ]);
    if (s.error || m.error) {
      setError(true);
      setLoading(false);
      return;
    }
    setError(false);
    setSlots((s.data ?? []) as SlotRow[]);
    const ms = (m.data ?? []) as unknown as DayMatch[];
    setMatches(ms);
    if (ms.length) {
      const { data: ps } = await supabase
        .from('match_participants')
        .select('match_id,status,hold_expires_at')
        .in('match_id', ms.map((x) => x.id));
      const count: Record<string, number> = {};
      for (const p of (ps ?? []) as { match_id: string; status: string; hold_expires_at: string | null }[]) {
        const ok = ['confirmed', 'attended', 'no_show'].includes(p.status) || (p.status === 'reserved' && (!p.hold_expires_at || new Date(p.hold_expires_at) > new Date()));
        if (ok) count[p.match_id] = (count[p.match_id] ?? 0) + 1;
      }
      setTaken(count);
    } else {
      setTaken({});
    }
    setLoading(false);
  }, [courtId, month]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  if (loading && !court) return <Spinner />;
  if (!court) {
    return (
      <Screen>
        <Banner>Quadra não encontrada.</Banner>
      </Screen>
    );
  }

  const counts: Record<string, number> = {};
  for (const s of slots) if (s.status === 'open') counts[s.slot_date] = (counts[s.slot_date] ?? 0) + 1;

  const daySlots = slots.filter((s) => s.slot_date === selected && s.status === 'open');
  const dayMatches = matches.filter((m) => m.court_slots?.slot_date === selected);
  const dow = WEEKDAY_SHORT[new Date(`${selected}T12:00:00`).getDay()];
  const [, sm, sd] = selected.split('-');
  const inst = court.institutions;

  return (
    <Screen padded={false}>
      <View style={{ height: 160, backgroundColor: colors.navy2 }}>
        {inst?.photo_url ? (
          <Image source={{ uri: inst.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 56 }}>⚽</Text>
          </View>
        )}
      </View>

      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text }}>{inst?.name}</Text>
        <Text style={{ color: colors.muted, marginBottom: 4 }}>
          {court.name} · {court.sport} · até {court.capacity} jogadores
        </Text>
        <Text style={{ color: colors.muted, marginBottom: 12 }}>
          {[inst?.address, inst?.city].filter(Boolean).join(' · ')}
        </Text>
        {court.rules ? (
          <Card>
            <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 4 }}>Regras da quadra</Text>
            <Muted>{court.rules}</Muted>
          </Card>
        ) : null}

        <SectionHeader title="Disponibilidade" />
        {error && <Banner>Não foi possível carregar os horários deste mês.</Banner>}
        <Calendar
          month={month}
          onMonthChange={(d) => {
            setMonth(d);
            setLoading(true);
          }}
          counts={counts}
          selected={selected}
          onSelect={setSelected}
        />

        <SectionHeader title={`${dow} ${sd}/${sm}`} />

        {dayMatches.length > 0 && (
          <>
            <Text style={{ fontWeight: '700', color: colors.muted, marginBottom: 8 }}>Partidas marcadas (entre em uma)</Text>
            {dayMatches.map((m) => {
              const total = m.line_slots + m.goalkeeper_slots;
              const t = taken[m.id] ?? 0;
              return (
                <Pressable key={m.id} onPress={() => router.push(`/partidas/${m.id}`)}>
                  <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: '800', color: colors.text, fontSize: 16 }}>
                        {m.court_slots ? `${shortTime(m.court_slots.start_time)}–${shortTime(m.court_slots.end_time)}` : ''}
                      </Text>
                      <Badge label={t >= total ? 'Lotada' : `${total - t} vagas`} tone={t >= total ? 'neutral' : 'success'} />
                    </View>
                    <Muted>{m.title || 'Partida'} · {formatBRL(m.line_price_cents)} por vaga</Muted>
                  </Card>
                </Pressable>
              );
            })}
          </>
        )}

        <Text style={{ fontWeight: '700', color: colors.muted, marginVertical: 8 }}>Horários livres para criar uma partida</Text>
        {daySlots.length === 0 ? (
          <Card>
            <Muted>Nenhum horário livre neste dia.</Muted>
          </Card>
        ) : (
          daySlots.map((s) => (
            <Card key={s.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: '800', color: colors.text, fontSize: 18 }}>
                  {shortTime(s.start_time)}–{shortTime(s.end_time)}
                </Text>
                <Text style={{ color: colors.blue, fontWeight: '800' }}>{formatBRL(s.price_cents)}</Text>
              </View>
              <Muted>até {s.max_players} jogadores</Muted>
              <View style={{ height: 6 }} />
              {s.organizer_booking ? (
                <Button title="Criar partida neste horário" onPress={() => router.push(`/partidas/nova?slotId=${s.id}`)} />
              ) : (
                <Badge label="Reservado só para a quadra" tone="neutral" />
              )}
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}
