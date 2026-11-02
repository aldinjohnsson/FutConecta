import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, Text } from 'react-native';

import { Banner, Button, Card, colors, Muted, Screen, Spinner, Subtitle, TextField, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { pickAndUploadImage } from '@/lib/upload';
import { Court, Institution } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

export default function MinhaQuadra() {
  const router = useRouter();
  const { session, refreshProfile } = useAuth();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);

  // formulário de cadastro da instituição
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const { data: inst } = await supabase
      .from('institutions')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('created_at')
      .limit(1)
      .maybeSingle();
    setInstitution((inst as Institution | null) ?? null);
    if (inst) {
      const { data: cs } = await supabase.from('courts').select('*').eq('institution_id', inst.id).order('name');
      setCourts((cs ?? []) as Court[]);
    }
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function changeCover() {
    if (!institution || !session) return;
    setError(null);
    try {
      const url = await pickAndUploadImage(`covers/${session.user.id}`, [16, 9]);
      if (!url) return;
      const { error: err } = await supabase.from('institutions').update({ photo_url: url }).eq('id', institution.id);
      if (err) throw new Error('Não foi possível salvar a capa.');
      setInstitution({ ...institution, photo_url: url });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function createInstitution() {
    setError(null);
    if (!name.trim() || !city.trim()) return setError('Informe o nome e a cidade.');
    setSaving(true);
    const { error: err } = await supabase.rpc('create_institution', {
      _name: name.trim(),
      _city: city.trim(),
      _address: address.trim() || null,
      _phone: phone.trim() || null,
    });
    setSaving(false);
    if (err) return setError('Não foi possível cadastrar. Tente novamente.');
    await refreshProfile(); // atualiza os papéis (agora é dono de quadra)
    await load();
  }

  if (loading) return <Spinner />;

  if (!institution) {
    return (
      <Screen>
        <Title>Cadastre sua instituição</Title>
        <Subtitle>Depois você cadastra as quadras e libera os horários para as partidas.</Subtitle>
        {error && <Banner>{error}</Banner>}
        <TextField label="Nome da instituição" value={name} onChangeText={setName} />
        <TextField label="Cidade" value={city} onChangeText={setCity} />
        <TextField label="Endereço" value={address} onChangeText={setAddress} />
        <TextField label="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Button title="Cadastrar instituição" onPress={createInstitution} loading={saving} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{institution.name}</Title>
      <Subtitle>
        {institution.city}
        {institution.address ? ` · ${institution.address}` : ''}
      </Subtitle>

      {institution.photo_url ? (
        <Image source={{ uri: institution.photo_url }} style={{ width: '100%', height: 150, borderRadius: 16, marginBottom: 10 }} resizeMode="cover" />
      ) : null}
      {error && <Banner>{error}</Banner>}
      <Button title={institution.photo_url ? 'Trocar capa da quadra' : 'Adicionar capa da quadra'} variant="secondary" onPress={changeCover} />
      <Button title="+ Nova quadra" onPress={() => router.push('/quadra/nova-quadra')} />

      {courts.length === 0 && (
        <Card>
          <Muted>Você ainda não cadastrou nenhuma quadra.</Muted>
        </Card>
      )}
      {courts.map((c) => (
        <Pressable key={c.id} onPress={() => router.push(`/quadra/${c.id}`)}>
          <Card>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{c.name}</Text>
            <Muted>
              {c.sport} · até {c.capacity} jogadores
            </Muted>
            <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 8 }}>Gerenciar horários →</Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
