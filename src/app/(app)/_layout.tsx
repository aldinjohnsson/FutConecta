import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/components/ui';
import { takePendingInvite } from '@/lib/invite';
import { ModeProvider, useMode } from '@/providers/ModeProvider';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <View style={{ width: 44, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.navy2 : 'transparent' }}>
      <Text style={{ fontSize: 17, opacity: focused ? 1 : 0.7 }}>{glyph}</Text>
    </View>
  );
}

function AppTabs() {
  const router = useRouter();
  const { mode } = useMode();
  const owner = mode === 'owner';
  // abas de um modo ficam escondidas (href: null) no outro, mas as rotas continuam existindo
  const playerTab = owner ? null : undefined;
  const ownerTab = owner ? undefined : null;

  // convite recebido por link (WhatsApp) antes de a pessoa ter conta: ao entrar, abre a partida
  useEffect(() => {
    takePendingInvite().then((matchId) => {
      if (matchId) router.replace(`/partidas/${matchId}`);
    });
  }, [router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#8FA3CC',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarStyle: { backgroundColor: colors.navy, borderTopWidth: 0, paddingTop: 6, height: 66 },
        sceneStyle: { backgroundColor: colors.bg },
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: '#fff',
        headerShadowVisible: false,
        headerTitleStyle: { color: '#fff', fontWeight: '800' },
      }}
    >
      {/* modo Jogador */}
      <Tabs.Screen name="index" options={{ title: 'Início', href: playerTab, tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} /> }} />
      <Tabs.Screen name="partidas" options={{ title: 'Meus horários', href: playerTab, tabBarIcon: ({ focused }) => <TabIcon glyph="📅" focused={focused} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Meu perfil', href: playerTab, headerShown: true, tabBarIcon: ({ focused }) => <TabIcon glyph="👤" focused={focused} /> }} />
      <Tabs.Screen name="explorar" options={{ title: 'Buscar quadras', href: playerTab, tabBarIcon: ({ focused }) => <TabIcon glyph="🔎" focused={focused} /> }} />

      {/* modo Dono da quadra */}
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', href: ownerTab, headerShown: true, tabBarIcon: ({ focused }) => <TabIcon glyph="🗓️" focused={focused} /> }} />
      <Tabs.Screen name="pagamentos" options={{ title: 'Pagamentos', href: ownerTab, headerShown: true, tabBarIcon: ({ focused }) => <TabIcon glyph="💰" focused={focused} /> }} />
      <Tabs.Screen name="quadra" options={{ title: 'Quadras', href: ownerTab, tabBarIcon: ({ focused }) => <TabIcon glyph="🏟️" focused={focused} /> }} />

      <Tabs.Screen name="mais" options={{ title: 'Mais', headerShown: true, tabBarIcon: ({ focused }) => <TabIcon glyph="☰" focused={focused} /> }} />
      {/* telas acessadas pelo menu "Mais" (sem botão na barra) */}
      <Tabs.Screen name="admin-banners" options={{ href: null, headerShown: true, title: 'Banners' }} />
    </Tabs>
  );
}

export default function AppLayout() {
  return (
    <ModeProvider>
      <AppTabs />
    </ModeProvider>
  );
}
