import { toISODate } from '@/lib/courts';
import { supabase } from '@/lib/supabase';
import { CommissionMode } from '@/lib/types';

export interface FeaturedMatch {
  id: string;
  title: string | null;
  sport: string;
  courtName: string;
  institutionName: string;
  city: string;
  coverUrl: string | null;
  slotDate: string;
  startTime: string;
  taken: number;
  total: number;
  /** valor base da vaga de linha (o que a quadra recebe) */
  linePriceCents: number;
  commissionMode: CommissionMode;
}

interface Row {
  id: string;
  title: string | null;
  line_slots: number;
  goalkeeper_slots: number;
  line_price_cents: number;
  courts: { name: string; sport: string; commission_mode: CommissionMode } | null;
  institutions: { name: string; city: string; photo_url: string | null } | null;
  court_slots: { slot_date: string; start_time: string; end_time: string } | null;
}
interface Part {
  match_id: string;
  status: string;
  hold_expires_at: string | null;
}

function isActive(p: Part): boolean {
  if (['confirmed', 'attended', 'no_show'].includes(p.status)) return true;
  return p.status === 'reserved' && (!p.hold_expires_at || new Date(p.hold_expires_at) > new Date());
}

/** Próximas partidas abertas (com vaga primeiro), para a vitrine da tela inicial. */
export async function loadFeaturedMatches(limit = 5): Promise<FeaturedMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id,title,line_slots,goalkeeper_slots,line_price_cents,courts(name,sport,commission_mode),institutions(name,city,photo_url),court_slots(slot_date,start_time,end_time)',
    )
    .eq('status', 'scheduled')
    .limit(100);
  if (error) throw error;

  const today = toISODate(new Date());
  const rows = ((data ?? []) as unknown as Row[])
    .filter((m) => m.court_slots && m.courts && m.court_slots.slot_date >= today)
    .sort((a, b) =>
      `${a.court_slots!.slot_date}${a.court_slots!.start_time}`.localeCompare(`${b.court_slots!.slot_date}${b.court_slots!.start_time}`),
    );
  if (rows.length === 0) return [];

  const { data: ps } = await supabase
    .from('match_participants')
    .select('match_id,status,hold_expires_at')
    .in(
      'match_id',
      rows.map((r) => r.id),
    );
  const taken: Record<string, number> = {};
  for (const p of (ps ?? []) as Part[]) {
    if (isActive(p)) taken[p.match_id] = (taken[p.match_id] ?? 0) + 1;
  }

  const list: FeaturedMatch[] = rows.map((m) => ({
    id: m.id,
    title: m.title,
    sport: m.courts!.sport,
    courtName: m.courts!.name,
    institutionName: m.institutions?.name ?? '',
    city: m.institutions?.city ?? '',
    coverUrl: m.institutions?.photo_url ?? null,
    slotDate: m.court_slots!.slot_date,
    startTime: m.court_slots!.start_time,
    taken: taken[m.id] ?? 0,
    total: m.line_slots + m.goalkeeper_slots,
    linePriceCents: m.line_price_cents,
    commissionMode: m.courts!.commission_mode,
  }));

  // com vaga primeiro; dentro de cada grupo, mantém a ordem por data
  return [...list.filter((m) => m.taken < m.total), ...list.filter((m) => m.taken >= m.total)].slice(0, limit);
}
