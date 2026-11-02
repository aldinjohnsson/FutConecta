export type AppRole = 'player' | 'venue_owner' | 'admin';
export type PlayerPosition = 'goalkeeper' | 'defender' | 'midfielder' | 'forward';
export type PreferredFoot = 'right' | 'left' | 'both';
export type CommissionMode = 'absorb' | 'pass_to_player';

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  birth_date: string | null;
  city: string | null;
  photo_url: string | null;
  preferred_foot: PreferredFoot | null;
  positions: PlayerPosition[];
  must_change_password: boolean;
  suspended_at: string | null;
}

export interface Institution {
  id: string;
  owner_id: string;
  name: string;
  address: string | null;
  city: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  description: string | null;
  active: boolean;
}

export interface Court {
  id: string;
  institution_id: string;
  name: string;
  sport: string;
  capacity: number;
  rules: string | null;
  commission_mode: CommissionMode;
  offline_surcharge_bps: number;
  free_cancel_hours: number;
  active: boolean;
}

export interface AvailabilityRule {
  id: string;
  court_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  price_cents: number;
  max_players: number;
  active: boolean;
}

export interface CourtSlot {
  id: string;
  court_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  price_cents: number;
  max_players: number;
  status: 'open' | 'booked' | 'closed' | 'cancelled';
}

export const POSITION_LABEL: Record<PlayerPosition, string> = {
  goalkeeper: 'Goleiro',
  defender: 'Zagueiro',
  midfielder: 'Meio-campo',
  forward: 'Atacante',
};

export const FOOT_LABEL: Record<PreferredFoot, string> = {
  right: 'Direito',
  left: 'Esquerdo',
  both: 'Ambidestro',
};

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export type SlotKind = 'line' | 'goalkeeper';
export type ParticipantStatus = 'reserved' | 'confirmed' | 'cancelled' | 'attended' | 'no_show';
export type MatchStatus = 'scheduled' | 'finished' | 'cancelled';

export interface Match {
  id: string;
  slot_id: string;
  court_id: string;
  institution_id: string;
  organizer_id: string;
  title: string | null;
  rules: string | null;
  status: MatchStatus;
  line_slots: number;
  goalkeeper_slots: number;
  line_price_cents: number;
  goalkeeper_price_cents: number;
  accepts_app_payment: boolean;
  accepts_manual_payment: boolean;
}

export interface Participant {
  id: string;
  match_id: string;
  user_id: string | null;
  guest_name: string | null;
  kind: SlotKind;
  status: ParticipantStatus;
  hold_expires_at: string | null;
  added_by: string;
}

export const KIND_LABEL: Record<SlotKind, string> = { line: 'Linha', goalkeeper: 'Goleiro' };

export const PARTICIPANT_LABEL: Record<ParticipantStatus, string> = {
  reserved: 'Aguardando pagamento',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  attended: 'Presente',
  no_show: 'Faltou',
};
