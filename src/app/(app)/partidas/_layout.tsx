import { Stack } from 'expo-router';

import { colors } from '@/components/ui';

export default function PartidasLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: '#fff',
        headerShadowVisible: false,
        headerTitleStyle: { color: '#fff', fontWeight: '800' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Meus horários' }} />
      <Stack.Screen name="nova" options={{ title: 'Criar partida' }} />
      <Stack.Screen name="[matchId]" options={{ title: 'Partida' }} />
    </Stack>
  );
}
