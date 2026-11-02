import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { Spinner } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';

export type AppMode = 'player' | 'owner';

interface ModeContextValue {
  /** Modo em uso. Quem não é dono de quadra está sempre no modo 'player'. */
  mode: AppMode;
  /** true se a conta pode alternar para o modo Dono. */
  ownerCapable: boolean;
  setMode: (mode: AppMode) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

const keyFor = (userId: string) => `app_mode:${userId}`;

export function ModeProvider({ children }: { children: ReactNode }) {
  const { roles, session } = useAuth();
  const userId = session?.user.id ?? null;
  const ownerCapable = roles.includes('venue_owner') || roles.includes('admin');

  const [stored, setStored] = useState<AppMode | null>(null);
  const [ready, setReady] = useState(false);

  // lembra a escolha de cada conta neste aparelho/navegador
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      let value: AppMode | null = null;
      if (userId) {
        try {
          const raw = await AsyncStorage.getItem(keyFor(userId));
          if (raw === 'owner' || raw === 'player') value = raw;
        } catch {
          // sem armazenamento: usa o padrão
        }
      }
      if (!cancelled) {
        setStored(value);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setMode = useCallback(
    (next: AppMode) => {
      setStored(next);
      if (userId) AsyncStorage.setItem(keyFor(userId), next).catch(() => {});
    },
    [userId],
  );

  const value = useMemo<ModeContextValue>(() => {
    // padrão: quem tem papel de dono abre o app no modo Dono
    const fallback: AppMode = roles.includes('venue_owner') ? 'owner' : 'player';
    return { mode: ownerCapable ? (stored ?? fallback) : 'player', ownerCapable, setMode };
  }, [ownerCapable, stored, roles, setMode]);

  if (!ready) return <Spinner />;
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode precisa estar dentro de <ModeProvider>');
  return ctx;
}
