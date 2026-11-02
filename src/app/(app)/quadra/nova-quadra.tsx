import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Banner, Button, Chip, ChipRow, Label, Muted, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { CommissionMode } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

export default function NovaQuadra() {
  const router = useRouter();
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [sport, setSport] = useState('futebol');
  const [capacity, setCapacity] = useState('12');
  const [rules, setRules] = useState('');
  const [mode, setMode] = useState<CommissionMode>('absorb');
  const [surcharge, setSurcharge] = useState('2');
  const [cancelHours, setCancelHours] = useState('24');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const cap = Number(capacity);
    const sur = Number(surcharge.replace(',', '.'));
    const hours = Number(cancelHours);
    if (!name.trim()) return setError('Informe o nome da quadra.');
    if (!Number.isInteger(cap) || cap <= 0) return setError('Capacidade inválida.');
    if (!Number.isFinite(sur) || sur < 0 || sur > 50) return setError('O acréscimo deve ficar entre 0% e 50%.');
    if (!Number.isInteger(hours) || hours < 0) return setError('Prazo de cancelamento inválido.');

    // a instituição é a do dono logado
    const { data: inst } = await supabase
      .from('institutions')
      .select('id')
      .eq('owner_id', session?.user.id ?? '')
      .order('created_at')
      .limit(1)
      .maybeSingle();
    if (!inst) return setError('Cadastre sua instituição primeiro.');

    setSaving(true);
    const { error: err } = await supabase.from('courts').insert({
      institution_id: inst.id,
      name: name.trim(),
      sport: sport.trim() || 'futebol',
      capacity: cap,
      rules: rules.trim() || null,
      commission_mode: mode,
      offline_surcharge_bps: Math.round(sur * 100),
      free_cancel_hours: hours,
    });
    setSaving(false);
    if (err) return setError('Não foi possível salvar a quadra.');
    router.back();
  }

  return (
    <Screen>
      {error && <Banner>{error}</Banner>}
      <TextField label="Nome da quadra" value={name} onChangeText={setName} placeholder="Quadra 1 - Society" />
      <TextField label="Modalidade" value={sport} onChangeText={setSport} />
      <TextField label="Capacidade (jogadores)" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
      <TextField
        label="Regras de utilização"
        value={rules}
        onChangeText={setRules}
        multiline
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />

      <Label>Comissão da plataforma (7%) nos pagamentos pelo app</Label>
      <ChipRow>
        <Chip label="Sai do meu valor" selected={mode === 'absorb'} onPress={() => setMode('absorb')} />
        <Chip label="Repassar ao jogador" selected={mode === 'pass_to_player'} onPress={() => setMode('pass_to_player')} />
      </ChipRow>
      <Muted>
        {mode === 'absorb'
          ? 'O jogador paga o valor do horário e a comissão é descontada do que você recebe.'
          : 'O jogador paga o valor do horário mais a comissão, e você recebe o valor cheio.'}
      </Muted>

      <TextField
        label="Acréscimo para pagamento fora do app (%)"
        value={surcharge}
        onChangeText={setSurcharge}
        keyboardType="decimal-pad"
      />
      <TextField
        label="Cancelamento gratuito até (horas antes)"
        value={cancelHours}
        onChangeText={setCancelHours}
        keyboardType="number-pad"
      />
      <Button title="Salvar quadra" onPress={save} loading={saving} />
    </Screen>
  );
}
