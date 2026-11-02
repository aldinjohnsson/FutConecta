import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Banner, Card, colors, Muted, Screen, Spinner, Subtitle, Title } from '@/components/ui';
import { formatBRL, formatSlotWhen } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { WEEKDAY_SHORT } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

interface MatchRow {
  id: string;
  title: string | null;
  organizer_id: string;
  line_slots: number;
  goalkeeper_slots: number;
  line_price_cents: number;
  courts: { name: string; sport: string } | null;
  institutions: { name: string } | null;
  court_slots: { slot_date: string; start_time: string; end_time: string } | null;
}
interface PartRow {
  match_id: string;
  user_id: string | null;
  status: string;
  hold_expires_at: string | null;
}

function isActive(p: PartRow): boolean {
  if (['confirmed', 'attended', 'no_show'].includes(p.status)) return true;
  return p.status === 'reserved' && (!p.hold_expires_at || new Date(p.hold_expires_at) > new Date());
}

export default function Partidas() {
  const router = useRouter();
  const { session } = useAuth();
  const me = session?.user.id;
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const { data, error: err } = await supabase
      .from('matches')
      .select(
        'id,title,organizer_id,line_slots,goalkeeper_slots,line_price_cents,courts(name,sport),institutions(name),court_slots(slot_date,start_time,end_time)',
      )
      .eq('status', 'scheduled')
      .limit(100);
    if (err) {
      setError(true);
      setLoading(false);
      return;
    }
    const rows = ((data ?? []) as unknown as MatchRow[])
      .filter((m) => m.court_slots && m.court_slots.slot_date >= new Date().toISOString().slice(0, 10))
      .sort((a, b) =>
        `${a.court_slots!.slot_date}${a.court_slots!.start_time}`.localeCompare(
          `${b.court_slots!.slot_date}${b.court_slots!.start_time}`,
        ),
      );
    setMatches(rows);
    if (rows.length) {
      const { data: ps } = await supabase
        .from('match_participants')
        .select('match_id,user_id,status,hold_expires_at')
        .in(
          'match_id',
          rows.map((r) => r.id),
        );
      setParts((ps ?? []) as PartRow[]);
    } else {
      setParts([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <Spinner />;

  const mine = matches.filter(
    (m) => m.organizer_id === me || parts.some((p) => p.match_id === m.id && p.user_id === me && isActive(p)),
  );
  const others = matches.filter((m) => !mine.includes(m));

  function renderMatch(m: MatchRow) {
    const taken = parts.filter((p) => p.match_id === m.id && isActive(p)).length;
    const total = m.line_slots + m.goalkeeper_slots;
    const when = m.court_slots ? formatSlotWhen(m.court_slots.slot_date, m.court_slots.start_time, WEEKDAY_SHORT) : '';
    return (
      <Pressable key={m.id} onPress={() => router.push(`/partidas/${m.id}`)}>
        <Card>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{m.title || 'Partida'}</Text>
          <Muted>
            {m.institutions?.name} · {m.courts?.name}
          </Muted>
          <Muted>{when}</Muted>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {taken}/{total} vagas ocupadas
            </Text>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{formatBRL(m.line_price_cents)}</Text>
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <Screen>
      <Title>Meus horários</Title>
      <Subtitle>Suas partidas e as abertas para entrar. Para criar uma, escolha um horário em Buscar quadras.</Subtitle>
      {error && <Banner>Não foi possível carregar as partidas.</Banner>}

      {mine.length > 0 && (
        <>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 }}>Minhas partidas</Text>
          {mine.map(renderMatch)}
        </>
      )}

      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginVertical: 8 }}>Abertas</Text>
      {others.length === 0 ? (
        <Card>
          <Muted>Nenhuma partida aberta no momento.</Muted>
        </Card>
      ) : (
        others.map(renderMatch)
      )}
    </Screen>
  );
}
