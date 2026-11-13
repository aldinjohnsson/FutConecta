import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { loadMyInvitations, loadMyNotices, onInvitesChanged } from '@/lib/invites';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Quantidade de convites pendentes do usuário. Recarrega ao focar a tela e quando a lista muda
 * (convite novo detectado, aceito ou recusado). Fica 0 se o recurso ainda não existir no banco.
 */
export function useInvitationCount() {
  const { session } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!session) return;
    Promise.all([loadMyInvitations().catch(() => []), loadMyNotices()])
      .then(([inv, notices]) => setCount(inv.length + notices.length))
      .catch(() => setCount(0));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useEffect(() => onInvitesChanged(refresh), [refresh]);

  return count;
}
