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
import { formatBRL, formatSlotWhen, parseBRLToCents, playerPaysCents } from '@/lib/format';
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
  const [gkSlots, setGkSlots] = useState('0');
  const [linePrice, setLinePrice] = useState('');
  const [gkPrice, setGkPrice] = useState('0');
  const [rules, setRules] = useState('');
  const [acceptsApp, setAcceptsApp] = useState(true);
  const [acceptsManual, setAcceptsManual] = useState(true);

  useEffect(() => {
    (async () => {
      if (!slotId) return setLoading(false);
      const { data: s } = await supabase.from('court_slots').select('*').eq('id', slotId).maybeSingle();
      if (s) {
        const sl = s as CourtSlot;
        setSlot(sl);
        const { data: c } = await supabase.from('courts').select('*').eq('id', sl.court_id).maybeSingle();
        setCourt((c as Court | null) ?? null);
        // sugestão: divide o valor do horário entre os jogadores
        setLineSlots(String(sl.max_players));
        setLinePrice(((Math.ceil(sl.price_cents / sl.max_players)) / 100).toFixed(2).replace('.', ','));
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
  const pLine = parseBRLToCents(linePrice) ?? 0;
  const pGk = parseBRLToCents(gkPrice) ?? 0;
  const expected = nLine * pLine + nGk * pGk;
  const belowSlotPrice = expected < slot.price_cents;

  async function submit() {
    setError(null);
    if (nLine + nGk < 1) return setError('Defina ao menos uma vaga.');
    if (nLine + nGk > slot!.max_players) return setError(`O horário comporta no máximo ${slot!.max_players} jogadores.`);
    if (parseBRLToCents(linePrice) === null) return setError('Valor da vaga de linha inválido.');
    if (parseBRLToCents(gkPrice) === null) return setError('Valor da vaga de goleiro inválido.');
    if (!acceptsApp && !acceptsManual) return setError('Escolha ao menos uma forma de pagamento.');

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
        <Muted>Máximo de {slot.max_players} jogadores</Muted>
      </Card>

      <TextField label="Nome da partida (opcional)" value={title} onChangeText={setTitle} placeholder="Racha de terça" />
      <TextField label="Vagas de linha" value={lineSlots} onChangeText={setLineSlots} keyboardType="number-pad" />
      <TextField
        label="Valor por vaga de linha (o que a quadra recebe)"
        value={linePrice}
        onChangeText={setLinePrice}
        keyboardType="decimal-pad"
        placeholder="15,00"
      />
      <TextField label="Vagas de goleiro" value={gkSlots} onChangeText={setGkSlots} keyboardType="number-pad" />
      <TextField
        label="Valor por vaga de goleiro (0 = gratuita)"
        value={gkPrice}
        onChangeText={setGkPrice}
        keyboardType="decimal-pad"
      />

      {belowSlotPrice && (
        <Banner kind="warn">
          A soma das vagas ({formatBRL(expected)}) é menor que o valor do horário ({formatBRL(slot.price_cents)}).
          Quem cobre a diferença é você, o organizador.
        </Banner>
      )}

      <Card>
        <Text style={{ fontWeight: '700', color: colors.text }}>Quanto o jogador paga</Text>
        <Muted>
          Pelo app: {formatBRL(playerPaysCents(pLine, court.commission_mode, commissionBps))} por vaga de linha
        </Muted>
        <Muted>
          Fora do app: {formatBRL(Math.round(pLine * (1 + court.offline_surcharge_bps / 10000)))} por vaga de linha
          (acréscimo de {court.offline_surcharge_bps / 100}%)
        </Muted>
      </Card>

      <Label>Formas de pagamento aceitas</Label>
      <ChipRow>
        <Chip label="Pelo app" selected={acceptsApp} onPress={() => setAcceptsApp(!acceptsApp)} />
        <Chip label="Manual (na quadra)" selected={acceptsManual} onPress={() => setAcceptsManual(!acceptsManual)} />
      </ChipRow>

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
