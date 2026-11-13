import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import InviteInbox from '@/components/InviteInbox';
import { colors } from '@/components/ui';
import { takePendingInvite } from '@/lib/invite';
import { ModeProvider, useMode } from '@/providers/ModeProvider';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <View style={{ width: 44, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.primarySoft : 'transparent' }}>
      <Text style={{ fontSize: 17, opacity: focused ? 1 : 0.75 }}>{glyph}</Text>
    </View>
  );
}

/**
 * Esconde só o BOTÃO da aba. Não usar `href: null`: nesta versão do Expo Router isso marca a rota como
 * "hidden" e navegar até ela redireciona para o início (quebrava Mais > Minha quadra, Agenda > partida etc.).
 */
const NO_BUTTON = { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const } };
const hideIf = (hidden: boolean) => (hidden ? NO_BUTTON : {});

function AppTabs() {
  const router = useRouter();
  const { mode } = useMode();
  const owner = mode === 'owner';
  // abas de um modo ficam sem botão no outro, mas as rotas continuam navegáveis
  const hidePlayer = hideIf(owner);
  const hideOwner = hideIf(!owner);

  // convite recebido por link (WhatsApp) antes de a pessoa ter conta: ao entrar, abre a partida
  useEffect(() => {
    takePendingInvite().then((matchId) => {
      if (matchId) router.replace(`/partidas/${matchId}`);
    });
  }, [router]);

  return (
    <>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, height: 66 },
        sceneStyle: { backgroundColor: colors.bg },
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: '#fff',
        headerShadowVisible: false,
        headerTitleStyle: { color: '#fff', fontWeight: '800' },
      }}
    >
      {/* modo Jogador */}
      <Tabs.Screen name="index" options={{ title: 'Início', ...hidePlayer, tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} /> }} />
      <Tabs.Screen name="partidas" options={{ title: 'Partidas', ...hidePlayer, tabBarIcon: ({ focused }) => <TabIcon glyph="🏆" focused={focused} /> }} />
      <Tabs.Screen name="explorar" options={{ title: 'Quadras', ...hidePlayer, tabBarIcon: ({ focused }) => <TabIcon glyph="🏟️" focused={focused} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Meu perfil', tabBarLabel: 'Perfil', ...hidePlayer, headerShown: true, tabBarIcon: ({ focused }) => <TabIcon glyph="👤" focused={focused} /> }} />

      {/* modo Dono da quadra */}
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', ...hideOwner, headerShown: true, tabBarIcon: ({ focused }) => <TabIcon glyph="🗓️" focused={focused} /> }} />
      <Tabs.Screen name="pagamentos" options={{ title: 'Pagamentos', ...hideOwner, headerShown: true, tabBarIcon: ({ focused }) => <TabIcon glyph="💰" focused={focused} /> }} />
      <Tabs.Screen name="quadra" options={{ title: 'Quadras', ...hideOwner, tabBarIcon: ({ focused }) => <TabIcon glyph="🏟️" focused={focused} /> }} />

      <Tabs.Screen name="mais" options={{ title: 'Mais', headerShown: true, tabBarIcon: ({ focused }) => <TabIcon glyph="☰" focused={focused} /> }} />
      {/* telas acessadas por botões/menus (sem botão na barra) */}
      <Tabs.Screen name="admin-banners" options={{ ...NO_BUTTON, headerShown: true, title: 'Banners' }} />
      <Tabs.Screen name="convites" options={{ ...NO_BUTTON, headerShown: true, title: 'Convites' }} />
      <Tabs.Screen name="jogadores" options={{ ...NO_BUTTON, headerShown: true, title: 'Buscar jogadores' }} />
    </Tabs>
    <InviteInbox />
    </>
  );
}

export default function AppLayout() {
  return (
    <ModeProvider>
      <AppTabs />
    </ModeProvider>
  );
}
