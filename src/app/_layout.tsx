import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Spinner } from '@/components/ui';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) return <Spinner />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
