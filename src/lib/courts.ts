import { supabase } from '@/lib/supabase';

export interface CourtCardData {
  courtId: string;
  courtName: string;
  sport: string;
  capacity: number;
  institutionId: string;
  institutionName: string;
  city: string;
  address: string | null;
  coverUrl: string | null;
  /** horários abertos por data (YYYY-MM-DD), próximos 60 dias */
  openByDate: Record<string, number>;
  /** menor preço (centavos) entre os horários abertos */
  minPriceCents: number | null;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export async function loadCourtCards(): Promise<CourtCardData[]> {
  const today = new Date();
  const [inst, slots] = await Promise.all([
    supabase
      .from('institutions')
      .select('id,name,city,address,photo_url,courts(id,name,sport,capacity,active)')
      .eq('active', true),
    supabase
      .from('court_slots')
      .select('court_id,slot_date,price_cents')
      .eq('status', 'open')
      .gte('slot_date', toISODate(today))
      .lte('slot_date', toISODate(addDays(today, 60)))
      .limit(3000),
  ]);
  if (inst.error || slots.error) throw new Error('falha ao carregar quadras');

  const byCourt: Record<string, { dates: Record<string, number>; min: number | null }> = {};
  for (const s of (slots.data ?? []) as { court_id: string; slot_date: string; price_cents: number }[]) {
    const e = (byCourt[s.court_id] ??= { dates: {}, min: null });
    e.dates[s.slot_date] = (e.dates[s.slot_date] ?? 0) + 1;
    e.min = e.min === null ? s.price_cents : Math.min(e.min, s.price_cents);
  }

  type InstRow = {
    id: string;
    name: string;
    city: string;
    address: string | null;
    photo_url: string | null;
    courts: { id: string; name: string; sport: string; capacity: number; active: boolean }[];
  };
  const out: CourtCardData[] = [];
  for (const i of (inst.data ?? []) as unknown as InstRow[]) {
    for (const c of i.courts ?? []) {
      if (!c.active) continue;
      out.push({
        courtId: c.id,
        courtName: c.name,
        sport: c.sport,
        capacity: c.capacity,
        institutionId: i.id,
        institutionName: i.name,
        city: i.city,
        address: i.address,
        coverUrl: i.photo_url,
        openByDate: byCourt[c.id]?.dates ?? {},
        minPriceCents: byCourt[c.id]?.min ?? null,
      });
    }
  }
  return out;
}

/** Texto de disponibilidade para o card: hoje, amanhã ou próximo dia livre. */
export function availabilityLabel(
  openByDate: Record<string, number>,
  weekdays: string[],
): { text: string; tone: 'success' | 'info' | 'neutral' } {
  const today = toISODate(new Date());
  const tomorrow = toISODate(addDays(new Date(), 1));
  if (openByDate[today]) {
    const n = openByDate[today];
    return { text: `Hoje: ${n} ${n === 1 ? 'horário' : 'horários'}`, tone: 'success' };
  }
  if (openByDate[tomorrow]) {
    const n = openByDate[tomorrow];
    return { text: `Amanhã: ${n} ${n === 1 ? 'horário' : 'horários'}`, tone: 'info' };
  }
  const next = Object.keys(openByDate).sort()[0];
  if (next) {
    const [, m, d] = next.split('-');
    const dow = weekdays[new Date(`${next}T12:00:00`).getDay()];
    return { text: `Próximo: ${dow} ${d}/${m}`, tone: 'info' };
  }
  return { text: 'Sem horários abertos', tone: 'neutral' };
}
