import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Comissão da plataforma em basis points (700 = 7%). Padrão 700 até carregar. */
export function usePlatformCommissionBps(): number {
  const [bps, setBps] = useState(700);
  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('commission_bps')
      .maybeSingle()
      .then(({ data }) => {
        if (data && typeof data.commission_bps === 'number') setBps(data.commission_bps);
      });
  }, []);
  return bps;
}
