import { useState } from 'react';

import { Banner, Button, Screen, Subtitle, TextField } from '@/components/ui';
import { isAdult, parseBRDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export default function Cadastro() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birth, setBirth] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSignUp() {
    setError(null);
    setInfo(null);

    if (fullName.trim().split(/\s+/).length < 2) return setError('Informe seu nome completo.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('E-mail inválido.');
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    const birthIso = parseBRDate(birth);
    if (!birthIso) return setError('Data de nascimento inválida. Use o formato DD/MM/AAAA.');
    if (!city.trim()) return setError('Informe sua cidade.');
    if (!isAdult(birthIso)) {
      return setError(
        'Menores de 18 anos precisam ser cadastrados por um responsável maior de idade, com termo de responsabilidade. Peça para o seu responsável criar a conta.',
      );
    }

    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), birth_date: birthIso, city: city.trim() } },
    });
    setLoading(false);

    if (err) {
      setError(err.message.includes('already') ? 'Este e-mail já está cadastrado.' : 'Não foi possível criar a conta.');
      return;
    }
    // Se a confirmação por e-mail estiver ligada no Supabase, não vem sessão.
    if (!data.session) setInfo('Conta criada! Confirme seu e-mail pelo link que enviamos e depois entre.');
  }

  return (
    <Screen>
      <Subtitle>Preencha seus dados para começar a jogar.</Subtitle>
      {error && <Banner>{error}</Banner>}
      {info && <Banner kind="info">{info}</Banner>}

      <TextField label="Nome completo" value={fullName} onChangeText={setFullName} autoComplete="name" />
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextField
        label="Senha (mínimo 8 caracteres)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <TextField
        label="Data de nascimento"
        value={birth}
        onChangeText={setBirth}
        placeholder="DD/MM/AAAA"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <TextField label="Cidade" value={city} onChangeText={setCity} />
      <Button title="Criar conta" onPress={handleSignUp} loading={loading} />
    </Screen>
  );
}
