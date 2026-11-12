import { supabase } from '@/lib/supabase';
import { PlayerPosition, PreferredFoot } from '@/lib/types';

export interface AvailablePlayer {
  id: string;
  fullName: string;
  age: number | null;
  city: string | null;
  positions: PlayerPosition[];
  foot: PreferredFoot | null;
  photoUrl: string | null;
  since: string | null;
  note: string | null;
}

interface Row {
  id: string;
  full_name: string;
  age: number | null;
  city: string | null;
  positions: string[] | null;
  preferred_foot: string | null;
  photo_url: string | null;
  available_since: string | null;
  available_note: string | null;
}

/** Jogadores que ligaram "Estou disponível para jogo" (só campos públicos, via função segura). */
export async function loadAvailablePlayers(opts: { position?: PlayerPosition | null; city?: string }): Promise<AvailablePlayer[]> {
  const { data, error } = await supabase.rpc('list_available_players', {
    _position: opts.position ?? null,
    _city: opts.city?.trim() || null,
  });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    fullName: r.full_name,
    age: r.age,
    city: r.city,
    positions: (r.positions ?? []) as PlayerPosition[],
    foot: (r.preferred_foot as PreferredFoot | null) ?? null,
    photoUrl: r.photo_url,
    since: r.available_since,
    note: r.available_note,
  }));
}

/** Liga/desliga a disponibilidade do usuário logado (e salva o recado opcional). */
export async function setAvailability(available: boolean, note?: string | null) {
  return supabase.rpc('set_availability', { _available: available, _note: note?.trim() || null });
}
