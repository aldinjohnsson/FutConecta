import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { loadOwnerAgenda, OwnerAgenda } from '@/lib/ownerData';
import { useAuth } from '@/providers/AuthProvider';

/** Carrega (e recarrega ao focar a tela) a agenda do dono da quadra. */
export function useOwnerAgenda() {
  const { session } = useAuth();
  const [data, setData] = useState<OwnerAgenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    if (!session) return;
    try {
      setError(false);
      setData(await loadOwnerAgenda(session.user.id));
    } catch {
      setError(true);
    }
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, loading, error, reload };
}
