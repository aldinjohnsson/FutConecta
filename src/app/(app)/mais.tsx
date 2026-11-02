import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, colors, Muted, Screen } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { useMode } from '@/providers/ModeProvider';

function Row({ glyph, title, subtitle, onPress }: { glyph: string; title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Text style={{ fontSize: 20 }}>{glyph}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', color: colors.text, fontSize: 16 }}>{title}</Text>
          {subtitle ? <Muted>{subtitle}</Muted> : null}
        </View>
        <Text style={{ color: colors.muted, fontSize: 22 }}>›</Text>
      </Card>
    </Pressable>
  );
}

export default function Mais() {
  const router = useRouter();
  const { roles, signOut, profile } = useAuth();
  const isOwner = roles.includes('venue_owner') || roles.includes('admin');
  const isAdmin = roles.includes('admin');
  const { mode, ownerCapable, setMode } = useMode();

  function switchMode() {
    const next = mode === 'owner' ? 'player' : 'owner';
    setMode(next);
    router.replace(next === 'owner' ? '/agenda' : '/');
  }

  return (
    <Screen>
      <Muted>{profile?.full_name}</Muted>
      <View style={{ height: 12 }} />
      {ownerCapable && (
        <Row
          glyph="🔄"
          title={mode === 'owner' ? 'Trocar para o modo Jogador' : 'Trocar para o modo Dono da quadra'}
          subtitle={
            mode === 'owner'
              ? 'Ver horários, partidas e convites como jogador'
              : 'Gerenciar horários, reservas e pagamentos da sua quadra'
          }
          onPress={switchMode}
        />
      )}
      {mode === 'owner' && <Row glyph="👤" title="Meu perfil" subtitle="Seus dados e senha" onPress={() => router.push('/perfil')} />}
      <Row
        glyph="🔑"
        title={isOwner ? 'Minha quadra' : 'Sou dono de quadra'}
        subtitle={isOwner ? 'Quadras, horários e capa' : 'Cadastre sua quadra e receba reservas'}
        onPress={() => router.push('/quadra')}
      />
      {isAdmin && <Row glyph="📣" title="Banners de propaganda" subtitle="Gerencie o banner da tela inicial" onPress={() => router.push('/admin-banners')} />}
      <Row glyph="🔔" title="Notificações" subtitle="Em breve" onPress={() => {}} />
      <Row glyph="📄" title="Termos e privacidade" subtitle="Em breve" onPress={() => {}} />
      <View style={{ height: 8 }} />
      <Button title="Sair da conta" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
