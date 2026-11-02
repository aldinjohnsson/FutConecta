import { supabase } from '@/lib/supabase';

export interface MyMatch {
  id: string;
  title: string | null;
  institutionName: string;
  courtName: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  role: 'organizer' | 'player';
}

/** Próximas partidas em que a pessoa é organizadora ou participante. */
export async function loadMyMatches(userId: string): Promise<MyMatch[]> {
  const [mp, org] = await Promise.all([
    supabase.from('match_participants').select('match_id').eq('user_id', userId).in('status', ['reserved', 'confirmed']),
    supabase.from('matches').select('id').eq('organizer_id', userId).eq('status', 'scheduled'),
  ]);
  const organizerIds = new Set(((org.data ?? []) as { id: string }[]).map((r) => r.id));
  const ids = Array.from(new Set([...organizerIds, ...((mp.data ?? []) as { match_id: string }[]).map((r) => r.match_id)]));
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from('matches')
    .select('id,title,courts(name),institutions(name),court_slots(slot_date,start_time,end_time)')
    .in('id', ids)
    .eq('status', 'scheduled');

  type Row = {
    id: string;
    title: string | null;
    courts: { name: string } | null;
    institutions: { name: string } | null;
    court_slots: { slot_date: string; start_time: string; end_time: string } | null;
  };
  const today = new Date().toISOString().slice(0, 10);
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.court_slots && r.court_slots.slot_date >= today)
    .map((r) => ({
      id: r.id,
      title: r.title,
      institutionName: r.institutions?.name ?? '',
      courtName: r.courts?.name ?? '',
      slotDate: r.court_slots!.slot_date,
      startTime: r.court_slots!.start_time,
      endTime: r.court_slots!.end_time,
      role: organizerIds.has(r.id) ? ('organizer' as const) : ('player' as const),
    }))
    .sort((a, b) => `${a.slotDate}${a.startTime}`.localeCompare(`${b.slotDate}${b.startTime}`));
}
