import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { loadMyInvitations } from '@/lib/invites';
import { useAuth } from '@/providers/AuthProvider';

/** Quantidade de convites pendentes do usuário (recarrega ao focar a tela). 0 se o recurso não existir ainda. */
export function useInvitationCount() {
  const { session } = useAuth();
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let alive = true;
      loadMyInvitations()
        .then((list) => alive && setCount(list.length))
        .catch(() => alive && setCount(0));
      return () => {
        alive = false;
      };
    }, [session]),
  );

  return count;
}
