import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Banner, Button, Muted, Screen, Spinner, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Institution } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

/** Perfil público da quadra (nome fantasia) e dados da empresa (nome empresarial). */
export default function EditarPerfilQuadra() {
  const router = useRouter();
  const { session } = useAuth();
  const [inst, setInst] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('institutions')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('created_at')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const i = data as Institution | null;
        setInst(i);
        if (i) {
          setName(i.name);
          setLegalName(i.legal_name ?? '');
          setCity(i.city);
          setAddress(i.address ?? '');
          setPhone(i.phone ?? '');
          setDescription(i.description ?? '');
        }
        setLoading(false);
      });
  }, [session]);

  async function save() {
    if (!inst) return;
    setError(null);
    if (!name.trim() || !city.trim()) return setError('Informe o nome e a cidade.');
    setSaving(true);
    const { error: err } = await supabase.rpc('update_institution', {
      _id: inst.id,
      _name: name,
      _legal_name: legalName,
      _city: city,
      _address: address,
      _phone: phone,
      _description: description,
    });
    setSaving(false);
    if (err) return setError(/update_institution|schema cache/i.test(err.message) ? 'Aplique a migration de edição no Supabase.' : err.message);
    router.back();
  }

  if (loading) return <Spinner />;
  if (!inst) return <Screen><Banner>Cadastre sua quadra primeiro.</Banner></Screen>;

  return (
    <Screen>
      {error && <Banner>{error}</Banner>}
      <TextField label="Nome do perfil da quadra" value={name} onChangeText={setName} placeholder="Como os jogadores veem" />
      <TextField label="Nome empresarial" value={legalName} onChangeText={setLegalName} placeholder="Razão social (uso interno)" />
      <Muted>O nome empresarial não aparece para os jogadores.</Muted>
      <TextField label="Cidade" value={city} onChangeText={setCity} />
      <TextField label="Endereço" value={address} onChangeText={setAddress} />
      <TextField label="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Sobre a quadra" value={description} onChangeText={setDescription} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
      <Button title="Salvar" onPress={save} loading={saving} />
    </Screen>
  );
}
