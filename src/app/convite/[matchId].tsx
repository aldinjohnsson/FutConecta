import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { Spinner } from '@/components/ui';
import { isMatchId, savePendingInvite } from '@/lib/invite';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Porta de entrada pública do convite (link compartilhado no WhatsApp).
 * - Já logado: vai direto para a partida.
 * - Sem conta/sessão: guarda o convite e leva para o cadastro; depois do login o app
 *   retoma a partida automaticamente (ver (app)/_layout.tsx).
 */
export default function Convite() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isMatchId(matchId)) {
      router.replace('/');
      return;
    }
    if (session) {
      router.replace(`/partidas/${matchId}`);
      return;
    }
    savePendingInvite(matchId).then(() => router.replace({ pathname: '/cadastro', params: { convite: '1' } }));
  }, [loading, session, matchId, router]);

  return <Spinner />;
}
