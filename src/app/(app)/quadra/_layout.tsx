import { Stack } from 'expo-router';

import { colors } from '@/components/ui';

export default function QuadraLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Minha quadra' }} />
      <Stack.Screen name="nova-quadra" options={{ title: 'Nova quadra' }} />
      <Stack.Screen name="[courtId]" options={{ title: 'Quadra' }} />
    </Stack>
  );
}
