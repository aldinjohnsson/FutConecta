import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, Muted, Screen, Subtitle, TextField, Title } from '@/components/ui';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError('E-mail ou senha incorretos.');
    // Em caso de sucesso, o guard do layout raiz leva para o app.
  }

  return (
    <Screen>
      <View style={{ height: 48 }} />
      <Title>⚽ Futebol Amador</Title>
      <Subtitle>Encontre quadras, entre nas partidas e pague pelo app.</Subtitle>

      {!isSupabaseConfigured && (
        <Banner kind="warn">
          Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env para entrar.
        </Banner>
      )}
      {error && <Banner>{error}</Banner>}

      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="voce@email.com"
      />
      <TextField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={handleLogin}
      />
      <Button title="Entrar" onPress={handleLogin} loading={loading} />

      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <Muted>Ainda não tem conta?</Muted>
        <Link href="/cadastro" style={{ color: '#0B7A3E', fontWeight: '700', marginTop: 6, fontSize: 16 }}>
          Criar conta
        </Link>
      </View>
    </Screen>
  );
}
