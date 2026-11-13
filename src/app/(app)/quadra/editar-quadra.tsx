import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Banner, Button, Chip, ChipRow, Label, Muted, Screen, Spinner, TextField } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';
import { CommissionMode, Court } from '@/lib/types';

export default function EditarQuadra() {
  const { courtId } = useLocalSearchParams<{ courtId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [sport, setSport] = useState('futebol');
  const [capacity, setCapacity] = useState('12');
  const [rules, setRules] = useState('');
  const [mode, setMode] = useState<CommissionMode>('absorb');
  const [surcharge, setSurcharge] = useState('2');
  const [cancelHours, setCancelHours] = useState('24');
  const [acceptsApp, setAcceptsApp] = useState(true);
  const [acceptsManual, setAcceptsManual] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courtId) return;
    supabase
      .from('courts')
      .select('*')
      .eq('id', courtId)
      .maybeSingle()
      .then(({ data }) => {
        const c = data as Court | null;
        if (c) {
          setName(c.name);
          setSport(c.sport);
          setCapacity(String(c.capacity));
          setRules(c.rules ?? '');
          setMode(c.commission_mode);
          setSurcharge(String(c.offline_surcharge_bps / 100));
          setCancelHours(String(c.free_cancel_hours));
          setAcceptsApp(c.accepts_app_payment ?? true);
          setAcceptsManual(c.accepts_manual_payment ?? true);
        }
        setLoading(false);
      });
  }, [courtId]);

  async function save() {
    setError(null);
    const cap = Number(capacity);
    const sur = Number(surcharge.replace(',', '.'));
    const hours = Number(cancelHours);
    if (!name.trim()) return setError('Informe o nome da quadra.');
    if (!Number.isInteger(cap) || cap <= 0) return setError('Capacidade inválida.');
    if (!Number.isFinite(sur) || sur < 0 || sur > 50) return setError('O acréscimo deve ficar entre 0% e 50%.');
    if (!Number.isInteger(hours) || hours < 0) return setError('Prazo de cancelamento inválido.');
    if (!acceptsApp && !acceptsManual) return setError('Escolha ao menos uma forma de pagamento.');
    setSaving(true);
    const { error: err } = await supabase.rpc('update_court', {
      _id: courtId,
      _name: name,
      _sport: sport,
      _capacity: cap,
      _rules: rules,
      _commission_mode: mode,
      _offline_surcharge_bps: Math.round(sur * 100),
      _free_cancel_hours: hours,
    });
    const pay = err ? null : await supabase.rpc('set_court_payment_methods', { _id: courtId, _app: acceptsApp, _manual: acceptsManual });
    setSaving(false);
    if (pay?.error) return setError('Aplique a migration de formas de pagamento no Supabase.');
    if (err) return setError(/update_court|schema cache/i.test(err.message) ? 'Aplique a migration de edição no Supabase.' : err.message);
    router.back();
  }

  async function remove() {
    const yes = await confirmAction('Excluir esta quadra? Ela some das listas e os horários livres são fechados.', 'Excluir');
    if (!yes) return;
    setError(null);
    setSaving(true);
    const { error: err } = await supabase.rpc('delete_court', { _id: courtId });
    setSaving(false);
    if (err) return setError(err.message);
    router.replace('/quadra');
  }

  if (loading) return <Spinner />;

  return (
    <Screen>
      {error && <Banner>{error}</Banner>}
      <TextField label="Nome da quadra" value={name} onChangeText={setName} />
      <TextField label="Modalidade" value={sport} onChangeText={setSport} />
      <TextField label="Capacidade (jogadores)" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
      <TextField label="Regras de utilização" value={rules} onChangeText={setRules} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />

      <Label>Comissão da plataforma nos pagamentos pelo app</Label>
      <ChipRow>
        <Chip label="Sai do meu valor" selected={mode === 'absorb'} onPress={() => setMode('absorb')} />
        <Chip label="Repassar ao jogador" selected={mode === 'pass_to_player'} onPress={() => setMode('pass_to_player')} />
      </ChipRow>
      <Muted>Vale para novos pagamentos; os já feitos não mudam.</Muted>

      <Label>Formas de pagamento aceitas nas partidas desta quadra</Label>
      <ChipRow>
        <Chip label="Pelo app" selected={acceptsApp} onPress={() => setAcceptsApp(!acceptsApp)} />
        <Chip label="Manual (na quadra)" selected={acceptsManual} onPress={() => setAcceptsManual(!acceptsManual)} />
      </ChipRow>
      <Muted>Pagamento manual custa R$ 1,50 a mais por jogador que no app.</Muted>

      <TextField label="Acréscimo para pagamento fora do app (%)" value={surcharge} onChangeText={setSurcharge} keyboardType="decimal-pad" />
      <TextField label="Cancelamento gratuito até (horas antes)" value={cancelHours} onChangeText={setCancelHours} keyboardType="number-pad" />
      <Button title="Salvar alterações" onPress={save} loading={saving} />
      <Button title="Excluir quadra" variant="danger" onPress={remove} disabled={saving} />
    </Screen>
  );
}
