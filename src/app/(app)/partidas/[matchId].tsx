import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import MatchHero, { InfoRow } from '@/components/MatchHero';
import { Banner, Button, Card, Chip, ChipRow, colors, Muted, Screen, Spinner } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { formatBRL, formatSlotWhen } from '@/lib/format';
import { inviteUrl, whatsappShareUrl } from '@/lib/invite';
import { supabase } from '@/lib/supabase';
import {
  Court,
  KIND_LABEL,
  Match,
  Participant,
  PARTICIPANT_LABEL,
  SlotKind,
  WEEKDAY_SHORT,
} from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

interface Slot {
  slot_date: string;
  start_time: string;
  end_time: string;
}
interface Item {
  id: string;
  participant_id: string;
  payment_id: string | null;
  status: string;
  source: string;
  charged_cents: number;
}
interface PendingPayment {
  id: string;
  amount_cents: number;
  credit_used_cents: number;
  provider: string;
  expires_at: string | null;
}
interface WaitEntry {
  id: string;
  kind: SlotKind;
  status: string;
  offer_expires_at: string | null;
}
interface Summary {
  participants: number;
  paid_count: number;
  pending_count: number;
  received_app_cents: number;
  received_manual_cents: number;
  commission_cents: number;
}

function isActive(p: Participant): boolean {
  if (['confirmed', 'attended', 'no_show'].includes(p.status)) return true;
  return p.status === 'reserved' && (!p.hold_expires_at || new Date(p.hold_expires_at) > new Date());
}

function hhmm(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function PartidaDetalhe() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const me = session?.user.id ?? '';

  const [match, setMatch] = useState<Match | null>(null);
  const [court, setCourt] = useState<Court | null>(null);
  const [instName, setInstName] = useState('');
  const [instPhoto, setInstPhoto] = useState<string | null>(null);
  const [instPlace, setInstPlace] = useState<string | null>(null);
  const [isCourtOwner, setIsCourtOwner] = useState(false); // dono da quadra: só ele confere pagamento e encerra
  const [slot, setSlot] = useState<Slot | null>(null);
  const [parts, setParts] = useState<Participant[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Item[]>([]);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [waits, setWaits] = useState<WaitEntry[]>([]);
  const [credit, setCredit] = useState(0);
  const [prices, setPrices] = useState<Record<SlotKind, number>>({ line: 0, goalkeeper: 0 });
  const [sandbox, setSandbox] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [teams, setTeams] = useState<{ a: string[]; b: string[] } | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestKind, setGuestKind] = useState<SlotKind>('line');
  const attemptKey = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const load = useCallback(async () => {
    if (!matchId) return;
    const { data: m } = await supabase
      .from('matches')
      .select('*, courts(*), institutions(name,photo_url,address,city,owner_id), court_slots(slot_date,start_time,end_time)')
      .eq('id', matchId)
      .maybeSingle();
    if (!m) {
      setLoading(false);
      return;
    }
    const row = m as unknown as Match & {
      courts: Court;
      institutions: { name: string; photo_url: string | null; address: string | null; city: string | null; owner_id: string };
      court_slots: Slot;
    };
    setMatch(row);
    setCourt(row.courts);
    setInstName(row.institutions?.name ?? '');
    setInstPhoto(row.institutions?.photo_url ?? null);
    setIsCourtOwner(row.institutions?.owner_id === me);
    setInstPlace([row.institutions?.address, row.institutions?.city].filter(Boolean).join(' · ') || null);
    setSlot(row.court_slots);

    const { data: ps } = await supabase.from('match_participants').select('*').eq('match_id', matchId).order('created_at');
    const list = (ps ?? []) as Participant[];
    setParts(list);

    const userIds = Array.from(new Set([...list.map((p) => p.user_id), row.organizer_id].filter(Boolean))) as string[];
    if (userIds.length) {
      const { data: pr } = await supabase.from('profiles').select('id,full_name').in('id', userIds);
      const map: Record<string, string> = {};
      for (const r of (pr ?? []) as { id: string; full_name: string }[]) map[r.id] = r.full_name;
      setNames(map);
    }

    const [it, pay, wl, bal, mg, st, pLine, pGk] = await Promise.all([
      supabase.from('payment_items').select('id,participant_id,payment_id,status,source,charged_cents').eq('match_id', matchId),
      supabase
        .from('payments')
        .select('id,amount_cents,credit_used_cents,provider,expires_at')
        .eq('match_id', matchId)
        .eq('payer_id', me)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle(),
      supabase.from('waitlist_entries').select('id,kind,status,offer_expires_at').eq('match_id', matchId).eq('user_id', me).in('status', ['waiting', 'offered']),
      supabase.rpc('credit_balance', { _user: me, _inst: row.institution_id }),
      supabase.rpc('can_manage_match', { _match: matchId }),
      supabase.from('platform_settings').select('sandbox_payments').maybeSingle(),
      supabase.rpc('compute_item_price', { _match: matchId, _kind: 'line', _source: 'app' }),
      supabase.rpc('compute_item_price', { _match: matchId, _kind: 'goalkeeper', _source: 'app' }),
    ]);
    setItems((it.data ?? []) as Item[]);
    setPending((pay.data as PendingPayment | null) ?? null);
    setWaits((wl.data ?? []) as WaitEntry[]);
    setCredit(typeof bal.data === 'number' ? bal.data : 0);
    setCanManage(mg.data === true);
    setSandbox(Boolean((st.data as { sandbox_payments?: boolean } | null)?.sandbox_payments));
    setPrices({
      line: (pLine.data as { charged_cents: number }[] | null)?.[0]?.charged_cents ?? 0,
      goalkeeper: (pGk.data as { charged_cents: number }[] | null)?.[0]?.charged_cents ?? 0,
    });

    if (mg.data === true) {
      const { data: sm } = await supabase.from('match_financial_summary').select('*').eq('match_id', matchId).maybeSingle();
      setSummary((sm as Summary | null) ?? null);
    }
    setLoading(false);
  }, [matchId, me]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // painel em tempo real: recarrega quando alguém entra, paga ou cancela
  useEffect(() => {
    if (!matchId) return;
    const channel = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_participants', filter: `match_id=eq.${matchId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_items', filter: `match_id=eq.${matchId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, load]);

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, okMsg?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: err } = await action();
    setBusy(false);
    if (err) {
      if (err.message.includes('uq_participant_user_active')) {
        setError('Você já tem uma vaga ativa. Veja a lista de participantes ou cancele a vaga atual para entrar de novo.');
        await load();
      } else {
        setError(err.message);
      }
      return false;
    }
    if (okMsg) setNotice(okMsg);
    await load();
    return true;
  }

  if (loading) return <Spinner />;
  if (!match || !court || !slot) {
    return (
      <Screen>
        <Banner>Partida não encontrada.</Banner>
      </Screen>
    );
  }

  // ---- regras da partida ----
  const active = parts.filter(isActive);
  const lineActive = active.filter((p) => p.kind === 'line'); // goleiro não entra no racha
  const myPart = lineActive.find((p) => p.user_id === me);
  const itemOf = (pid: string) => items.find((i) => i.participant_id === pid && ['paid', 'pending'].includes(i.status));
  const nameOf = (p: Participant) => (p.user_id ? names[p.user_id] ?? 'Jogador' : `${p.guest_name} (convidado)`);
  const finished = match.status !== 'scheduled';
  const locked = !!match.confirmed_at;
  const seats = match.line_slots;
  const quorum = match.min_players ?? seats;
  const confirmed = lineActive.filter((p) => ['confirmed', 'attended', 'no_show'].includes(p.status));
  const organizerName = names[match.organizer_id] ?? 'organizador';

  const startAt = new Date(`${slot.slot_date}T${slot.start_time}`);
  const endAt = new Date(`${slot.slot_date}T${slot.end_time}`);
  const payOpensAt = new Date(endAt.getTime() - 10 * 60 * 1000); // pagamento liberado 10 min antes do fim
  const payOpen = Date.now() >= payOpensAt.getTime();

  // minhas vagas que já podem ser pagas (confirmou presença e ainda não pagou)
  const payable = lineActive.filter(
    (p) => ['confirmed', 'attended', 'no_show'].includes(p.status) && (p.user_id === me || p.added_by === me) && !itemOf(p.id),
  );
  const payTotal = payable.reduce((sum, p) => sum + prices[p.kind], 0);
  const myItem = myPart ? itemOf(myPart.id) : undefined;
  const myPaid = myItem?.status === 'paid';

  const when = `${formatSlotWhen(slot.slot_date, slot.start_time, WEEKDAY_SHORT)}–${slot.end_time.slice(0, 5)}`;

  async function shareWhatsApp() {
    const free = Math.max(seats - lineActive.length, 0);
    const text = [
      `⚽ ${match!.title || 'Partida de futebol'}`,
      `${instName} · ${court!.name}`,
      when,
      `Vagas livres: ${free}`,
      '',
      'Entre pelo link (é preciso ter conta no app):',
      inviteUrl(match!.id),
    ].join('\n');
    try {
      await Linking.openURL(whatsappShareUrl(text));
    } catch {
      setError('Não foi possível abrir o WhatsApp.');
    }
  }

  async function checkoutIds(ids: string[]) {
    if (ids.length === 0) return setError('Não há nada para pagar agora.');
    const sorted = [...ids].sort();
    const ok = await run(
      () =>
        supabase.rpc('create_checkout', {
          _match: match!.id,
          _participant_ids: sorted,
          _idempotency_key: `${me}:${match!.id}:${sorted.join('+')}:${attemptKey.current}`,
          _provider: 'sandbox',
          _use_credit: true,
        }),
      'Pagamento criado.',
    );
    if (ok) attemptKey.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function leave(p: Participant, own: boolean) {
    const yes = await confirmAction(own ? 'Desistir da sua vaga? O organizador será avisado.' : `Cancelar a vaga de ${nameOf(p)}?`, 'Cancelar vaga');
    if (yes) await run(() => supabase.rpc('cancel_participation', { _participant: p.id }), 'Vaga cancelada.');
  }

  async function lockMatch() {
    const yes = await confirmAction('Efetivar a partida? Ela passa a ser confirmada e NINGUÉM mais poderá cancelar a vaga.', 'Efetivar');
    if (yes) await run(() => supabase.rpc('lock_match', { _match: match!.id }), 'Partida efetivada!');
  }

  async function cancelMatch() {
    const yes = await confirmAction('Cancelar a partida? Todas as vagas serão liberadas.', 'Cancelar partida');
    if (yes) await run(() => supabase.rpc('cancel_match', { _match: match!.id }), 'Partida cancelada.');
  }

  // ---- escalação (sorteio entre os confirmados) ----
  function drawTeams() {
    const arr = confirmed.map(nameOf);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const half = Math.ceil(arr.length / 2);
    setTeams({ a: arr.slice(0, half), b: arr.slice(half) });
  }
  async function shareTeams() {
    if (!teams) return;
    const text = [
      `⚽ Escalação · ${match!.title || court!.name} · ${when}`,
      '',
      'TIME A',
      ...teams.a.map((n, i) => `${i + 1}. ${n}`),
      '',
      'TIME B',
      ...teams.b.map((n, i) => `${i + 1}. ${n}`),
    ].join('\n');
    try {
      await Linking.openURL(whatsappShareUrl(text));
    } catch {
      setError('Não foi possível abrir o WhatsApp.');
    }
  }

  // ---- textos da lista ----
  function statusOf(p: Participant): { text: string; tone: 'ok' | 'wait' | 'bad' } {
    const it = itemOf(p.id);
    if (it?.status === 'paid') return { text: 'pago', tone: 'ok' };
    if (p.status === 'no_show') return { text: 'faltou · pagamento pendente', tone: 'bad' };
    if (p.status === 'attended') return { text: 'presente', tone: 'ok' };
    if (p.status === 'confirmed') return { text: 'confirmado', tone: 'ok' };
    return { text: 'aguardando confirmação', tone: 'wait' };
  }

  const heroBadge: { label: string; tone: 'success' | 'warn' | 'neutral' } =
    match.status === 'cancelled'
      ? { label: 'Cancelada', tone: 'neutral' }
      : finished
        ? { label: 'Encerrada', tone: 'neutral' }
        : locked
          ? { label: 'Partida confirmada ✓', tone: 'success' }
          : { label: `${confirmed.length} de ${quorum} confirmados`, tone: confirmed.length >= quorum ? 'success' : 'warn' };

  const sorted = [...lineActive].sort((a, b) => (a.user_id === match.organizer_id ? -1 : b.user_id === match.organizer_id ? 1 : 0));
  const rows = Array.from({ length: seats }, (_, i) => sorted[i] ?? null);

  const tone = { ok: colors.primary, wait: '#B45309', bad: '#DC2626' };

  return (
    <Screen padded={false}>
      <MatchHero photoUrl={instPhoto} title={court.name} subtitle={`${instName} · organizada por ${organizerName}`} badge={heroBadge} />

      <View style={{ padding: 16, paddingTop: 18 }}>
        {error && <Banner>{error}</Banner>}
        {notice && <Banner kind="info">{notice}</Banner>}
        {match.status === 'cancelled' && <Banner kind="warn">Esta partida foi cancelada.</Banner>}
        {match.status === 'finished' && <Banner kind="warn">Esta partida foi encerrada.</Banner>}

        <Card>
          <InfoRow glyph="📅" label="Data e horário" value={when} />
          <InfoRow glyph="📍" label="Local" value={instName} sub={[court.name, instPlace].filter(Boolean).join(' · ')} />
        </Card>

        {/* Lista de jogadores */}
        <Card>
          <Text style={{ fontWeight: '900', fontSize: 16, color: colors.text, marginBottom: 6 }}>
            Jogadores ({lineActive.length}/{seats})
          </Text>
          {rows.map((p, i) => {
            const st = p ? statusOf(p) : null;
            const isMe = p?.user_id === me;
            return (
              <View
                key={p?.id ?? `vago-${i}`}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: p ? colors.primarySoft : '#EEF2EF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Text style={{ fontWeight: '800', fontSize: 12, color: p ? colors.primary : colors.muted }}>{i + 1}</Text>
                </View>
                {p && st ? (
                  <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>
                    <Text style={{ fontWeight: '800' }}>
                      {nameOf(p)}
                      {isMe ? ' (você)' : ''}
                      {p.user_id === match.organizer_id ? ' (organizador)' : ''}
                    </Text>
                    <Text style={{ color: tone[st.tone] }}>{`  ${st.text}`}</Text>
                  </Text>
                ) : (
                  <Text style={{ flex: 1, color: colors.muted, fontSize: 15, fontStyle: 'italic' }}>vago</Text>
                )}
                {/* quem gerencia cancela a vaga de outra pessoa enquanto não efetivou */}
                {p && canManage && !finished && !locked && !isMe && ['reserved', 'confirmed'].includes(p.status) && (
                  <Text onPress={() => leave(p, false)} style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>
                    Remover
                  </Text>
                )}
              </View>
            );
          })}
        </Card>

        {/* Minha vaga */}
        {!finished && myPart && (
          <Card>
            <Text style={{ fontWeight: '900', fontSize: 16, color: colors.text }}>Sua vaga</Text>
            <Text style={{ color: tone[statusOf(myPart).tone], fontWeight: '800', marginTop: 2 }}>{statusOf(myPart).text}</Text>
            <View style={{ height: 8 }} />

            {myPart.status === 'reserved' && (
              <Button
                title="Confirmar presença"
                loading={busy}
                onPress={() => run(() => supabase.rpc('confirm_presence', { _participant: myPart.id }), 'Presença confirmada!')}
              />
            )}
            {myPart.status === 'reserved' && <Muted>O pagamento é só depois do jogo.</Muted>}

            {myPart.status === 'confirmed' && !myPaid && (
              <Muted>
                Você confirmou presença. Se faltar, o valor fica pendente e será cobrado.
              </Muted>
            )}

            {/* pagamento: liberado 10 min antes do fim da partida */}
            {payable.length > 0 && !pending && match.accepts_app_payment &&
              (payOpen ? (
                <Button
                  title={payTotal === 0 ? 'Confirmar' : `Pagar ${formatBRL(payTotal)}`}
                  loading={busy}
                  onPress={() => checkoutIds(payable.map((p) => p.id))}
                />
              ) : (
                <Muted>💳 Pagamento liberado às {hhmm(payOpensAt.toISOString())}, 10 min antes do fim da partida.</Muted>
              ))}
            {credit > 0 && <Muted>Seu crédito nesta quadra: {formatBRL(credit)}</Muted>}

            {['reserved', 'confirmed'].includes(myPart.status) &&
              (locked ? (
                <Muted>Partida efetivada: não é mais possível cancelar a vaga.</Muted>
              ) : (
                <Button title="Desistir da vaga" variant="secondary" loading={busy} onPress={() => leave(myPart, true)} />
              ))}
          </Card>
        )}

        {/* pagamento em andamento */}
        {pending && (
          <Card>
            <Text style={{ fontWeight: '800', color: colors.text }}>Pagamento em aberto</Text>
            <Muted>
              Total: {formatBRL(pending.amount_cents)}
              {pending.credit_used_cents > 0 ? ` (crédito usado: ${formatBRL(pending.credit_used_cents)})` : ''}
            </Muted>
            <Muted>Expira às {hhmm(pending.expires_at)}</Muted>
            {sandbox ? (
              <>
                <Banner kind="warn">Modo de TESTE: nenhum dinheiro real é cobrado.</Banner>
                <Button
                  title="Confirmar pagamento de teste"
                  loading={busy}
                  onPress={() => run(() => supabase.rpc('sandbox_confirm_payment', { _payment: pending.id }), 'Pagamento confirmado (teste).')}
                />
              </>
            ) : (
              <Banner kind="info">O pagamento por Pix e cartão (Asaas) será liberado na próxima etapa.</Banner>
            )}
          </Card>
        )}

        {!myPart && !canManage && !finished && (
          <Card>
            <Muted>A entrada nesta partida é por convite do organizador.</Muted>
          </Card>
        )}

        {/* ===== Dono da partida ===== */}
        {canManage && !finished && (
          <>
            {!locked && (
              <Card>
                <Text style={{ fontWeight: '900', fontSize: 16, color: colors.text, marginBottom: 4 }}>Organizar</Text>
                {lineActive.length < seats && (
                  <>
                    <Muted>Chame jogadores disponíveis ou compartilhe o link.</Muted>
                    <Button title="Buscar jogadores disponíveis" onPress={() => router.push('/jogadores')} />
                    <Button title="Compartilhar no WhatsApp" variant="secondary" onPress={shareWhatsApp} />
                  </>
                )}
                <Muted>
                  Confirmados: {confirmed.length} de {quorum}.
                  {confirmed.length >= quorum
                    ? ' Pode efetivar: depois disso ninguém mais cancela.'
                    : ' Faltam confirmações para efetivar.'}
                </Muted>
                <Button title="Efetivar partida" loading={busy} disabled={confirmed.length < quorum} onPress={lockMatch} />
                {confirmed.length < quorum && (
                  <Button title="Cancelar partida" variant="danger" loading={busy} onPress={cancelMatch} />
                )}
              </Card>
            )}

            {confirmed.length >= 2 && (
              <Card>
                <Text style={{ fontWeight: '900', fontSize: 16, color: colors.text, marginBottom: 4 }}>Escalação</Text>
                <Muted>Sorteia os times com os confirmados ({confirmed.length}).</Muted>
                <Button title={teams ? 'Sortear de novo' : 'Gerar times'} variant={teams ? 'secondary' : 'primary'} onPress={drawTeams} />
                {teams && (
                  <>
                    <View style={{ flexDirection: 'row', gap: 10, marginVertical: 8 }}>
                      {([['TIME A', teams.a], ['TIME B', teams.b]] as const).map(([label, list]) => (
                        <View key={label} style={{ flex: 1, backgroundColor: colors.primarySoft, borderRadius: 14, padding: 12 }}>
                          <Text style={{ fontWeight: '900', color: colors.primary, marginBottom: 4 }}>{label}</Text>
                          {list.map((n, i) => (
                            <Text key={n + i} style={{ color: colors.text, marginVertical: 1 }}>
                              {i + 1}. {n}
                            </Text>
                          ))}
                        </View>
                      ))}
                    </View>
                    <Button title="Compartilhar escalação" variant="secondary" onPress={shareTeams} />
                  </>
                )}
              </Card>
            )}
          </>
        )}

        {/* ===== Dono da quadra ===== */}
        {isCourtOwner && !finished && (
          <Card>
            <Text style={{ fontWeight: '900', fontSize: 16, color: colors.text, marginBottom: 6 }}>Dono da quadra</Text>
            {lineActive
              .filter((p) => ['reserved', 'confirmed', 'attended', 'no_show'].includes(p.status) && itemOf(p.id)?.status !== 'paid')
              .map((p) => (
                <View key={p.id} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ fontWeight: '700', color: colors.text }}>{nameOf(p)}</Text>
                  {match.accepts_manual_payment && (
                    <Button
                      title="Marcar como pago (manual)"
                      variant="secondary"
                      loading={busy}
                      onPress={async () => {
                        const yes = await confirmAction(`Confirmar que ${nameOf(p)} pagou na quadra?`, 'Confirmar');
                        if (yes) await run(() => supabase.rpc('confirm_manual_payment', { _participant: p.id }), 'Pagamento manual registrado.');
                      }}
                    />
                  )}
                  {Date.now() >= startAt.getTime() && ['confirmed', 'attended', 'no_show'].includes(p.status) && (
                    <ChipRow>
                      <Chip label="Presente" selected={p.status === 'attended'} onPress={() => run(() => supabase.rpc('set_attendance', { _participant: p.id, _attended: true }))} />
                      <Chip label="Faltou" selected={p.status === 'no_show'} onPress={() => run(() => supabase.rpc('set_attendance', { _participant: p.id, _attended: false }))} />
                    </ChipRow>
                  )}
                </View>
              ))}
            {summary && (
              <View style={{ marginTop: 8 }}>
                <Muted>
                  Pagos: {summary.paid_count} · Pendentes: {summary.pending_count}
                </Muted>
                <Muted>Recebido pelo app: {formatBRL(summary.received_app_cents)}</Muted>
                <Muted>Recebido na quadra (manual): {formatBRL(summary.received_manual_cents)}</Muted>
                <Muted>Comissão da plataforma: {formatBRL(summary.commission_cents)}</Muted>
              </View>
            )}
            <Button
              title="Encerrar partida (já aconteceu)"
              variant="danger"
              loading={busy}
              onPress={async () => {
                const yes = await confirmAction('Encerrar a partida? Depois disso não é possível marcar presença.', 'Encerrar');
                if (yes) await run(() => supabase.rpc('finish_match', { _match: match.id }), 'Partida encerrada.');
              }}
            />
          </Card>
        )}
      </View>
    </Screen>
  );
}
