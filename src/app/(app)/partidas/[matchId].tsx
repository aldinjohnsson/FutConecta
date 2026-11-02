import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  colors,
  Label,
  Muted,
  Screen,
  Spinner,
  Subtitle,
  Title,
} from '@/components/ui';
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
  const { session } = useAuth();
  const me = session?.user.id ?? '';

  const [match, setMatch] = useState<Match | null>(null);
  const [court, setCourt] = useState<Court | null>(null);
  const [instName, setInstName] = useState('');
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
      .select('*, courts(*), institutions(name), court_slots(slot_date,start_time,end_time)')
      .eq('id', matchId)
      .maybeSingle();
    if (!m) {
      setLoading(false);
      return;
    }
    const row = m as unknown as Match & {
      courts: Court;
      institutions: { name: string };
      court_slots: Slot;
    };
    setMatch(row);
    setCourt(row.courts);
    setInstName(row.institutions?.name ?? '');
    setSlot(row.court_slots);

    const { data: ps } = await supabase.from('match_participants').select('*').eq('match_id', matchId).order('created_at');
    const list = (ps ?? []) as Participant[];
    setParts(list);

    const userIds = Array.from(new Set(list.map((p) => p.user_id).filter(Boolean))) as string[];
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

  const active = parts.filter(isActive);
  const taken = (k: SlotKind) => active.filter((p) => p.kind === k).length;
  const capacity = (k: SlotKind) => (k === 'line' ? match.line_slots : match.goalkeeper_slots);
  const isFull = (k: SlotKind) => taken(k) >= capacity(k);
  const myPart = active.find((p) => p.user_id === me);
  const itemOf = (pid: string) => items.find((i) => i.participant_id === pid && ['paid', 'pending'].includes(i.status));
  const nameOf = (p: Participant) => (p.user_id ? names[p.user_id] ?? 'Jogador' : `${p.guest_name} (convidado)`);
  const finished = match.status !== 'scheduled';

  // participações que eu posso pagar agora
  const payable = active.filter(
    (p) => p.status === 'reserved' && (p.user_id === me || p.added_by === me) && !itemOf(p.id),
  );
  const selectedPayable = payable.filter((p) => selected.includes(p.id));
  const totalSelected = selectedPayable.reduce((sum, p) => sum + prices[p.kind], 0);

  async function join(kind: SlotKind) {
    await run(() => supabase.rpc('join_match', { _match: match!.id, _kind: kind }), 'Vaga reservada! Conclua o pagamento antes de expirar.');
  }

  async function shareWhatsApp() {
    const livresLinha = Math.max(capacity('line') - taken('line'), 0);
    const livresGoleiro = Math.max(capacity('goalkeeper') - taken('goalkeeper'), 0);
    const text = [
      `⚽ ${match!.title || 'Partida de futebol'}`,
      `${instName} · ${court!.name}`,
      `${formatSlotWhen(slot!.slot_date, slot!.start_time, WEEKDAY_SHORT)}–${slot!.end_time.slice(0, 5)}`,
      `Vagas livres: ${livresLinha} de linha` + (match!.goalkeeper_slots > 0 ? ` e ${livresGoleiro} de goleiro` : ''),
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

  async function addGuest() {
    if (!guestName.trim()) return setError('Informe o nome do convidado.');
    const ok = await run(
      () => supabase.rpc('join_match', { _match: match!.id, _kind: guestKind, _guest_name: guestName.trim() }),
      'Convidado adicionado.',
    );
    if (ok) setGuestName('');
  }

  async function checkout() {
    if (selectedPayable.length === 0) return setError('Selecione ao menos uma participação para pagar.');
    const ids = selectedPayable.map((p) => p.id).sort();
    const ok = await run(
      () =>
        supabase.rpc('create_checkout', {
          _match: match!.id,
          _participant_ids: ids,
          _idempotency_key: `${me}:${match!.id}:${ids.join('+')}:${attemptKey.current}`,
          _provider: 'sandbox',
          _use_credit: true,
        }),
      'Pagamento criado.',
    );
    if (ok) {
      setSelected([]);
      attemptKey.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }

  async function cancel(p: Participant) {
    const yes = await confirmAction(`Cancelar a vaga de ${nameOf(p)}?`, 'Cancelar vaga');
    if (!yes) return;
    await run(() => supabase.rpc('cancel_participation', { _participant: p.id }), 'Vaga cancelada.');
  }

  return (
    <Screen>
      <Title>{match.title || 'Partida'}</Title>
      <Subtitle>
        {instName} · {court.name}
        {'\n'}
        {formatSlotWhen(slot.slot_date, slot.start_time, WEEKDAY_SHORT)}–{slot.end_time.slice(0, 5)}
      </Subtitle>

      {error && <Banner>{error}</Banner>}
      {notice && <Banner kind="info">{notice}</Banner>}
      {finished && <Banner kind="warn">Esta partida foi encerrada.</Banner>}
      {match.rules ? (
        <Card>
          <Label>Regras</Label>
          <Text style={{ color: colors.text }}>{match.rules}</Text>
        </Card>
      ) : null}

      {/* Vagas */}
      <Card>
        <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 6 }}>Vagas</Text>
        <Muted>
          Linha: {taken('line')}/{match.line_slots} · {prices.line === 0 ? 'gratuita' : formatBRL(prices.line)} pelo app
        </Muted>
        {match.goalkeeper_slots > 0 && (
          <Muted>
            Goleiro: {taken('goalkeeper')}/{match.goalkeeper_slots} ·{' '}
            {prices.goalkeeper === 0 ? 'gratuita' : formatBRL(prices.goalkeeper)} pelo app
          </Muted>
        )}
        {credit > 0 && <Muted>Seu crédito nesta quadra: {formatBRL(credit)}</Muted>}
      </Card>

      {/* Convidar */}
      {!finished && (
        <Card>
          <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 8 }}>Convidar jogadores</Text>
          <Muted>Compartilhe o link da partida. Quem ainda não tem conta cria o cadastro e já cai aqui.</Muted>
          <Button title="Compartilhar no WhatsApp" variant="secondary" onPress={shareWhatsApp} />
        </Card>
      )}

      {/* Entrar */}
      {!finished && !myPart && (
        <Card>
          <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 8 }}>Entrar na partida</Text>
          {(['line', 'goalkeeper'] as SlotKind[])
            .filter((k) => capacity(k) > 0)
            .map((k) => {
              const myWait = waits.find((w) => w.kind === k);
              if (isFull(k)) {
                if (myWait?.status === 'offered') {
                  return (
                    <View key={k}>
                      <Banner kind="info">
                        Abriu uma vaga de {KIND_LABEL[k].toLowerCase()} para você até {hhmm(myWait.offer_expires_at)}.
                      </Banner>
                      <Button
                        title={`Aceitar vaga de ${KIND_LABEL[k].toLowerCase()}`}
                        loading={busy}
                        onPress={() => run(() => supabase.rpc('accept_waitlist_offer', { _waitlist: myWait.id }), 'Vaga reservada!')}
                      />
                    </View>
                  );
                }
                return myWait ? (
                  <Muted key={k}>Você está na lista de espera de {KIND_LABEL[k].toLowerCase()}.</Muted>
                ) : (
                  <Button
                    key={k}
                    title={`Lista de espera · ${KIND_LABEL[k]}`}
                    variant="secondary"
                    loading={busy}
                    onPress={() => run(() => supabase.rpc('join_waitlist', { _match: match.id, _kind: k }), 'Você entrou na lista de espera.')}
                  />
                );
              }
              return <Button key={k} title={`Entrar como ${KIND_LABEL[k].toLowerCase()}`} loading={busy} onPress={() => join(k)} />;
            })}
        </Card>
      )}

      {/* Pagamento em aberto */}
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

      {/* Pagar */}
      {!finished && payable.length > 0 && !pending && match.accepts_app_payment && (
        <Card>
          <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 8 }}>Pagar pelo app</Text>
          <Muted>Selecione as vagas que quer pagar (a sua e as dos convidados que você adicionou).</Muted>
          <ChipRow>
            {payable.map((p) => (
              <Chip
                key={p.id}
                label={`${nameOf(p)} · ${prices[p.kind] === 0 ? 'grátis' : formatBRL(prices[p.kind])}`}
                selected={selected.includes(p.id)}
                onPress={() => setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}
              />
            ))}
          </ChipRow>
          {selectedPayable.length > 0 && <Muted>Total: {formatBRL(totalSelected)}</Muted>}
          <Button title="Ir para o pagamento" onPress={checkout} loading={busy} disabled={selectedPayable.length === 0} />
          {match.accepts_manual_payment && (
            <Muted>Prefere pagar na quadra? Peça ao organizador ou ao dono para marcar como pago (há acréscimo de {court.offline_surcharge_bps / 100}%).</Muted>
          )}
        </Card>
      )}

      {/* Convidado */}
      {!finished && (
        <Card>
          <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 8 }}>Adicionar convidado</Text>
          <Label>Nome</Label>
          <TextInput
            value={guestName}
            onChangeText={setGuestName}
            placeholder="Nome do amigo"
            placeholderTextColor="#9AA8A0"
            style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 10, backgroundColor: '#fff' }}
          />
          <ChipRow>
            {(['line', 'goalkeeper'] as SlotKind[])
              .filter((k) => capacity(k) > 0)
              .map((k) => (
                <Chip key={k} label={KIND_LABEL[k]} selected={guestKind === k} onPress={() => setGuestKind(k)} />
              ))}
          </ChipRow>
          <Button title="Adicionar" variant="secondary" onPress={addGuest} loading={busy} />
        </Card>
      )}

      {/* Lista de participantes */}
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginVertical: 8 }}>Participantes ({active.length})</Text>
      {active.length === 0 && (
        <Card>
          <Muted>Ninguém entrou ainda.</Muted>
        </Card>
      )}
      {active.map((p) => {
        const it = itemOf(p.id);
        const mine = p.user_id === me || p.added_by === me;
        const status =
          p.status === 'reserved' && it?.status === 'pending'
            ? 'Pagamento em andamento'
            : p.status === 'reserved'
              ? p.hold_expires_at
                ? `Aguardando pagamento até ${hhmm(p.hold_expires_at)}`
                : 'Aguardando pagamento'
              : PARTICIPANT_LABEL[p.status];
        return (
          <Card key={p.id}>
            <Text style={{ fontWeight: '700', color: colors.text }}>
              {nameOf(p)}
              {p.user_id && p.user_id === match.organizer_id ? ' (organizador)' : ''} · {KIND_LABEL[p.kind]}
            </Text>
            <Muted>
              {status}
              {it?.status === 'paid' ? (it.source === 'manual' ? ' · pago na quadra' : it.source === 'app' ? ' · pago pelo app' : '') : ''}
            </Muted>

            {!finished && (mine || canManage) && ['reserved', 'confirmed'].includes(p.status) && (
              <Button title="Cancelar vaga" variant="secondary" loading={busy} onPress={() => cancel(p)} />
            )}

            {!finished && canManage && match.accepts_manual_payment && ['reserved', 'confirmed'].includes(p.status) && it?.status !== 'paid' && (
              <Button
                title="Marcar como pago (manual)"
                loading={busy}
                onPress={async () => {
                  const yes = await confirmAction(`Confirmar que ${nameOf(p)} pagou na quadra?`, 'Confirmar');
                  if (yes) await run(() => supabase.rpc('confirm_manual_payment', { _participant: p.id }), 'Pagamento manual registrado.');
                }}
              />
            )}

            {!finished && canManage && ['confirmed', 'attended', 'no_show'].includes(p.status) && (
              <ChipRow>
                <Chip
                  label="Presente"
                  selected={p.status === 'attended'}
                  onPress={() => run(() => supabase.rpc('set_attendance', { _participant: p.id, _attended: true }))}
                />
                <Chip
                  label="Faltou"
                  selected={p.status === 'no_show'}
                  onPress={() => run(() => supabase.rpc('set_attendance', { _participant: p.id, _attended: false }))}
                />
              </ChipRow>
            )}
          </Card>
        );
      })}

      {/* Painel de quem gerencia */}
      {canManage && (
        <Card>
          <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 6 }}>Painel do organizador / quadra</Text>
          {summary && (
            <>
              <Muted>
                Pagos: {summary.paid_count} · Pendentes: {summary.pending_count}
              </Muted>
              <Muted>Recebido pelo app: {formatBRL(summary.received_app_cents)}</Muted>
              <Muted>Recebido na quadra (manual): {formatBRL(summary.received_manual_cents)}</Muted>
              <Muted>Comissão da plataforma: {formatBRL(summary.commission_cents)}</Muted>
            </>
          )}
          {!finished && (
            <Button
              title="Encerrar partida"
              variant="danger"
              loading={busy}
              onPress={async () => {
                const yes = await confirmAction('Encerrar a partida? Depois disso não é possível marcar presença.', 'Encerrar');
                if (yes) await run(() => supabase.rpc('finish_match', { _match: match.id }), 'Partida encerrada.');
              }}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}
