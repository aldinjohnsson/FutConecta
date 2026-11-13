import { toISODate } from '@/lib/courts';
import { supabase } from '@/lib/supabase';
import { SlotKind } from '@/lib/types';

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

/** Partida em que a pessoa pode convidar (organizador ou dono da quadra), com vagas livres. */
export interface ManageableMatch {
  id: string;
  title: string | null;
  courtName: string;
  slotDate: string;
  startTime: string;
  lineFree: number;
  goalkeeperFree: number;
}

export interface ReceivedInvitation {
  id: string;
  matchId: string;
  kind: SlotKind;
  title: string | null;
  courtName: string;
  institutionName: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  inviterName: string | null;
}

interface MatchRow {
  id: string;
  title: string | null;
  line_slots: number;
  goalkeeper_slots: number;
  courts: { name: string } | null;
  court_slots: { slot_date: string; start_time: string } | null;
}
interface PartRow {
  match_id: string;
  kind: SlotKind;
  status: string;
  hold_expires_at: string | null;
}

function isActive(p: PartRow): boolean {
  if (['confirmed', 'attended', 'no_show'].includes(p.status)) return true;
  return p.status === 'reserved' && (!p.hold_expires_at || new Date(p.hold_expires_at) > new Date());
}

/** Próximas partidas que o usuário organiza (ou das quadras dele), com vagas de linha/goleiro livres. */
export async function loadManageableMatches(userId: string): Promise<ManageableMatch[]> {
  const { data: inst } = await supabase.from('institutions').select('id').eq('owner_id', userId);
  const instIds = ((inst ?? []) as { id: string }[]).map((i) => i.id);

  let q = supabase
    .from('matches')
    .select('id,title,line_slots,goalkeeper_slots,courts(name),court_slots(slot_date,start_time)')
    .eq('status', 'scheduled');
  q = instIds.length ? q.or(`organizer_id.eq.${userId},institution_id.in.(${instIds.join(',')})`) : q.eq('organizer_id', userId);
  const { data, error } = await q.limit(100);
  if (error) throw error;

  const today = toISODate(new Date());
  const rows = ((data ?? []) as unknown as MatchRow[])
    .filter((m) => m.court_slots && m.court_slots.slot_date >= today)
    .sort((a, b) =>
      `${a.court_slots!.slot_date}${a.court_slots!.start_time}`.localeCompare(`${b.court_slots!.slot_date}${b.court_slots!.start_time}`),
    );
  if (rows.length === 0) return [];

  const { data: ps } = await supabase
    .from('match_participants')
    .select('match_id,kind,status,hold_expires_at')
    .in(
      'match_id',
      rows.map((r) => r.id),
    );
  const taken: Record<string, { line: number; goalkeeper: number }> = {};
  for (const p of (ps ?? []) as PartRow[]) {
    if (!isActive(p)) continue;
    const t = (taken[p.match_id] ??= { line: 0, goalkeeper: 0 });
    t[p.kind] += 1;
  }

  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    courtName: m.courts?.name ?? '',
    slotDate: m.court_slots!.slot_date,
    startTime: m.court_slots!.start_time,
    lineFree: Math.max(m.line_slots - (taken[m.id]?.line ?? 0), 0),
    goalkeeperFree: Math.max(m.goalkeeper_slots - (taken[m.id]?.goalkeeper ?? 0), 0),
  }));
}

/** Último status do convite de cada jogador nesta partida (userId -> status). */
export async function loadMatchInvitationStatuses(matchId: string): Promise<Record<string, InviteStatus>> {
  const { data, error } = await supabase.rpc('list_match_invitations', { _match: matchId });
  if (error) throw error;
  const out: Record<string, InviteStatus> = {};
  for (const r of (data ?? []) as { invited_user_id: string; status: InviteStatus }[]) out[r.invited_user_id] = r.status;
  return out;
}

export function invitePlayer(matchId: string, userId: string, kind: SlotKind) {
  return supabase.rpc('invite_player', { _match: matchId, _user: userId, _kind: kind });
}

// avisa as telas (contador do Início etc.) quando a lista de convites muda
const listeners = new Set<() => void>();
export function onInvitesChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function notifyInvitesChanged() {
  listeners.forEach((cb) => cb());
}

export async function respondInvitation(invitationId: string, accept: boolean) {
  const res = await supabase.rpc('respond_invitation', { _invitation: invitationId, _accept: accept });
  if (!res.error) notifyInvitesChanged();
  return res;
}

/** Convites pendentes que o usuário recebeu (de partidas futuras). */
export async function loadMyInvitations(): Promise<ReceivedInvitation[]> {
  const { data, error } = await supabase.rpc('list_my_invitations');
  if (error) throw error;
  type Row = {
    id: string;
    match_id: string;
    kind: string;
    title: string | null;
    court_name: string;
    institution_name: string;
    slot_date: string;
    start_time: string;
    end_time: string;
    inviter_name: string | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    matchId: r.match_id,
    kind: r.kind as SlotKind,
    title: r.title,
    courtName: r.court_name,
    institutionName: r.institution_name,
    slotDate: r.slot_date,
    startTime: r.start_time,
    endTime: r.end_time,
    inviterName: r.inviter_name,
  }));
}

/** Mensagem amigável quando a migration de convites ainda não foi aplicada no Supabase. */
export function inviteErrorText(message: string): string {
  if (/invite_player|respond_invitation|list_my_invitations|list_match_invitations|match_invitations|schema cache|does not exist/i.test(message)) {
    return 'Recurso indisponível: aplique a migration de convites no Supabase.';
  }
  return message;
}
