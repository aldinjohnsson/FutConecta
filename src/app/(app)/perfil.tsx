import { useEffect, useState } from 'react';
import { View } from 'react-native';

import PlayerCard from '@/components/PlayerCard';

import { Banner, Button, Card, Chip, ChipRow, Label, Muted, Screen, TextField } from '@/components/ui';
import { FOOT_LABEL, POSITION_LABEL, PlayerPosition, PreferredFoot } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

const POSITIONS = Object.keys(POSITION_LABEL) as PlayerPosition[];
const FEET = Object.keys(FOOT_LABEL) as PreferredFoot[];

export default function Perfil() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [positions, setPositions] = useState<PlayerPosition[]>([]);
  const [foot, setFoot] = useState<PreferredFoot | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name);
    setCity(profile.city ?? '');
    setPositions(profile.positions ?? []);
    setFoot(profile.preferred_foot);
  }, [profile]);

  function togglePosition(p: PlayerPosition) {
    setPositions((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function save() {
    if (!session) return;
    setMessage(null);
    if (fullName.trim().split(/\s+/).length < 2) {
      setMessage({ kind: 'error', text: 'Informe seu nome completo.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        city: city.trim() || null,
        positions,
        preferred_foot: foot,
      })
      .eq('id', session.user.id);
    setSaving(false);
    if (error) {
      setMessage({ kind: 'error', text: 'Não foi possível salvar. Tente novamente.' });
      return;
    }
    await refreshProfile();
    setMessage({ kind: 'info', text: 'Perfil atualizado.' });
  }

  return (
    <Screen>
      {profile && <PlayerCard profile={profile} />}
      <View style={{ height: 16 }} />
      <Muted>{profile?.email}</Muted>
      <Card style={{ marginTop: 16 }}>
        {message && <Banner kind={message.kind}>{message.text}</Banner>}
        <TextField label="Nome completo" value={fullName} onChangeText={setFullName} />
        <TextField label="Cidade" value={city} onChangeText={setCity} />

        <Label>Posições que você joga</Label>
        <ChipRow>
          {POSITIONS.map((p) => (
            <Chip key={p} label={POSITION_LABEL[p]} selected={positions.includes(p)} onPress={() => togglePosition(p)} />
          ))}
        </ChipRow>

        <Label>Pé dominante</Label>
        <ChipRow>
          {FEET.map((f) => (
            <Chip key={f} label={FOOT_LABEL[f]} selected={foot === f} onPress={() => setFoot(f)} />
          ))}
        </ChipRow>

        <Button title="Salvar" onPress={save} loading={saving} />
      </Card>

      <Card>
        <Label>Estatísticas</Label>
        <Muted>Estatísticas manuais (jogos, gols, assistências) são lançadas pelo organizador ou pelo administrador.</Muted>
        <Muted>Estatísticas com IA: em breve.</Muted>
      </Card>

      <Button title="Sair" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
