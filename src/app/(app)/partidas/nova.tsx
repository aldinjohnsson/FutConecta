import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

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
  TextField,
  Title,
} from '@/components/ui';
import { formatBRL, formatSlotWhen, playerPaysCents } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Court, CourtSlot, WEEKDAY_SHORT } from '@/lib/types';
import { usePlatformCommissionBps } from '@/lib/usePlatformCommission';

export default function NovaPartida() {
  const router = useRouter();
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const commissionBps = usePlatformCommissionBps();

  const [slot, setSlot] = useState<CourtSlot | null>(null);
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [lineSlots, setLineSlots] = useState('');
  const [gkSlots, setGkSlots] = useState('2');
  const [gkFree, setGkFree] = useState(true); // goleiro é gratuito (já marcado)
  const [rules, setRules] = useState('');

  useEffect(() => {
    (async () => {
      if (!slotId) return setLoading(false);
      const { data: s } = await supabase.from('court_slots').select('*').eq('id', slotId).maybeSingle();
      if (s) {
        const sl = s as CourtSlot;
        setSlot(sl);
        const { data: c } = await supabase.from('courts').select('*').eq('id', sl.court_id).maybeSingle();
        setCourt((c as Court | null) ?? null);
        setLineSlots(String(sl.max_players));
      }
      setLoading(false);
    })();
  }, [slotId]);

  if (loading) return <Spinner />;
  if (!slot || !court) {
    return (
      <Screen>
        <Banner>Horário não encontrado.</Banner>
      </Screen>
    );
  }

  const nLine = Number(lineSlots) || 0;
  const nGk = Number(gkSlots) || 0;
  // o valor por vaga vem do horário da quadra: valor do horário dividido entre os jogadores de linha
  const pLine = nLine > 0 ? Math.ceil(slot.price_cents / nLine) : 0;
  const pGk = gkFree ? 0 : pLine;
  const teams = Math.floor(nLine / 5);
  const acceptsApp = court.accepts_app_payment ?? true;
  const acceptsManual = court.accepts_manual_payment ?? true;
  const appPays = playerPaysCents(pLine, court.commission_mode, commissionBps);
  const MANUAL_EXTRA = 150; // pagamento manual: sempre R$ 1,50 a mais que no app

  async function submit() {
    setError(null);
    if (nLine < 2) return setError('Defina ao menos 2 jogadores de linha.');
    if (nLine > slot!.max_players) return setError(`O horário comporta no máximo ${slot!.max_players} jogadores de linha.`);

    setSaving(true);
    const { data, error: err } = await supabase.rpc('create_match', {
      _slot: slot!.id,
      _title: title.trim() || null,
      _line_slots: nLine,
      _goalkeeper_slots: nGk,
      _line_price_cents: pLine,
      _goalkeeper_price_cents: pGk,
      _accepts_app: acceptsApp,
      _accepts_manual: acceptsManual,
      _payment_deadline: null,
      _rules: rules.trim() || null,
    });
    setSaving(false);
    if (err) return setError(err.message);
    router.replace(`/partidas/${data as string}`);
  }

  return (
    <Screen>
      <Title>Criar partida</Title>
      <Subtitle>
        {court.name} · {formatSlotWhen(slot.slot_date, slot.start_time, WEEKDAY_SHORT)}
      </Subtitle>

      <Card>
        <Muted>Valor do horário definido pela quadra: {formatBRL(slot.price_cents)}</Muted>
        <Muted>Máximo de {slot.max_players} jogadores de linha</Muted>
      </Card>

      <TextField label="Nome da partida (opcional)" value={title} onChangeText={setTitle} placeholder="Racha de terça" />
      <TextField label="Jogadores de linha" value={lineSlots} onChangeText={setLineSlots} keyboardType="number-pad" />
      {teams >= 2 && <Muted>{nLine} na linha = {teams} times de 5 (os goleiros não entram nos times).</Muted>}

      <Label>Goleiros</Label>
      <TextField label="Quantidade de goleiros" value={gkSlots} onChangeText={setGkSlots} keyboardType="number-pad" />
      <ChipRow>
        <Chip label={gkFree ? 'Goleiro é gratuito ✓' : 'Goleiro é gratuito'} selected={gkFree} onPress={() => setGkFree(!gkFree)} />
      </ChipRow>
      <Muted>Os goleiros são escolhidos na hora do jogo.</Muted>

      <Card>
        <Text style={{ fontWeight: '700', color: colors.text }}>Quanto cada jogador de linha paga</Text>
        <Muted>Valor definido pela quadra: {formatBRL(slot.price_cents)} dividido entre {nLine || '…'} jogadores.</Muted>
        {acceptsApp && <Muted>Pelo app: {formatBRL(appPays)}</Muted>}
        {acceptsManual && <Muted>Na quadra (manual): {formatBRL(appPays + MANUAL_EXTRA)} (R$ 1,50 a mais que no app)</Muted>}
        <Muted>
          Formas de pagamento definidas pela quadra: {[acceptsApp && 'app', acceptsManual && 'manual'].filter(Boolean).join(' e ')}.
        </Muted>
      </Card>

      <TextField
        label="Regras (opcional)"
        value={rules}
        onChangeText={setRules}
        multiline
        placeholder="Ex.: chegar 10 min antes, levar colete"
      />

      {error && <Banner>{error}</Banner>}
      <Button title="Criar partida" onPress={submit} loading={saving} />
    </Screen>
  );
}
