import { supabase } from '@/lib/supabase';
import { Participant, SlotKind } from '@/lib/types';

export interface OwnerRow {
  participantId: string;
  name: string;
  kind: SlotKind;
  isOrganizer: boolean;
  paid: boolean;
  /** 'app' | 'manual' quando pago */
  paidSource: string | null;
}

export interface OwnerMatch {
  id: string;
  title: string | null;
  courtName: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  lineSlots: number;
  goalkeeperSlots: number;
  acceptsManual: boolean;
  rows: OwnerRow[];
  paidCount: number;
  pendingCount: number;
}

export interface OwnerMoney {
  appCents: number;
  manualCents: number;
  commissionCents: number;
}

export interface OwnerAgenda {
  institutionId: string | null;
  institutionName: string;
  matches: OwnerMatch[];
  /** null quando a visão financeira não pôde ser lida */
  money: OwnerMoney | null;
}

/** Mesma regra da tela da partida: reserva vencida não conta como vaga ocupada. */
function isActive(p: Participant): boolean {
  if (['confirmed', 'attended', 'no_show'].includes(p.status)) return true;
  return p.status === 'reserved' && (!p.hold_expires_at || new Date(p.hold_expires_at) > new Date());
}

function localToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface MatchQuery {
  id: string;
  title: string | null;
  organizer_id: string;
  line_slots: number;
  goalkeeper_slots: number;
  accepts_manual_payment: boolean;
  courts: { name: string } | null;
  court_slots: { slot_date: string; start_time: string; end_time: string } | null;
}

/** Próximas partidas das quadras do dono, com quem entrou e quem já pagou. */
export async function loadOwnerAgenda(userId: string): Promise<OwnerAgenda> {
  const { data: inst } = await supabase
    .from('institutions')
    .select('id,name')
    .eq('owner_id', userId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (!inst) return { institutionId: null, institutionName: '', matches: [], money: null };

  const { data: ms, error } = await supabase
    .from('matches')
    .select('id,title,organizer_id,line_slots,goalkeeper_slots,accepts_manual_payment,courts(name),court_slots(slot_date,start_time,end_time)')
    .eq('institution_id', inst.id)
    .eq('status', 'scheduled')
    .limit(200);
  if (error) throw error;

  const today = localToday();
  const rows = ((ms ?? []) as unknown as MatchQuery[])
    .filter((m) => m.court_slots && m.court_slots.slot_date >= today)
    .sort((a, b) =>
      `${a.court_slots!.slot_date}${a.court_slots!.start_time}`.localeCompare(`${b.court_slots!.slot_date}${b.court_slots!.start_time}`),
    );
  if (rows.length === 0) return { institutionId: inst.id, institutionName: inst.name, matches: [], money: null };

  const ids = rows.map((r) => r.id);
  const [parts, items, fin] = await Promise.all([
    supabase.from('match_participants').select('id,match_id,user_id,guest_name,kind,status,hold_expires_at,added_by').in('match_id', ids).order('created_at'),
    supabase.from('payment_items').select('participant_id,status,source').in('match_id', ids),
    supabase.from('match_financial_summary').select('match_id,received_app_cents,received_manual_cents,commission_cents').in('match_id', ids),
  ]);
  if (parts.error) throw parts.error;

  const participants = ((parts.data ?? []) as Participant[]).filter(isActive);
  const userIds = Array.from(new Set(participants.map((p) => p.user_id).filter(Boolean))) as string[];
  const names: Record<string, string> = {};
  if (userIds.length) {
    const { data: pr } = await supabase.from('profiles').select('id,full_name').in('id', userIds);
    for (const r of (pr ?? []) as { id: string; full_name: string }[]) names[r.id] = r.full_name;
  }

  const paidItem = new Map<string, string>(); // participant_id -> source
  for (const it of (items.data ?? []) as { participant_id: string; status: string; source: string }[]) {
    if (it.status === 'paid') paidItem.set(it.participant_id, it.source);
  }

  const matches: OwnerMatch[] = rows.map((m) => {
    const list: OwnerRow[] = participants
      .filter((p) => p.match_id === m.id)
      .map((p) => ({
        participantId: p.id,
        name: p.user_id ? (names[p.user_id] ?? 'Jogador') : `${p.guest_name} (convidado)`,
        kind: p.kind,
        isOrganizer: Boolean(p.user_id) && p.user_id === m.organizer_id,
        paid: paidItem.has(p.id),
        paidSource: paidItem.get(p.id) ?? null,
      }));
    const paidCount = list.filter((r) => r.paid).length;
    return {
      id: m.id,
      title: m.title,
      courtName: m.courts?.name ?? '',
      slotDate: m.court_slots!.slot_date,
      startTime: m.court_slots!.start_time,
      endTime: m.court_slots!.end_time,
      lineSlots: m.line_slots,
      goalkeeperSlots: m.goalkeeper_slots,
      acceptsManual: m.accepts_manual_payment,
      rows: list,
      paidCount,
      pendingCount: list.length - paidCount,
    };
  });

  let money: OwnerMoney | null = null;
  if (!fin.error && fin.data) {
    money = { appCents: 0, manualCents: 0, commissionCents: 0 };
    for (const f of fin.data as { received_app_cents: number; received_manual_cents: number; commission_cents: number }[]) {
      money.appCents += f.received_app_cents ?? 0;
      money.manualCents += f.received_manual_cents ?? 0;
      money.commissionCents += f.commission_cents ?? 0;
    }
  }

  return { institutionId: inst.id, institutionName: inst.name, matches, money };
}
