import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStands, type GeoFix } from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { cachedFix, getFixIfAllowed } from '@/lib/location';
import { useSession } from '@/lib/session';

const round3 = (n: number | null | undefined) => (typeof n === 'number' ? Math.round(n * 1000) / 1000 : null);

// Stands with free counts, nearest first when a fix is available. Never asks for the location
// permission (04 R08); call `locate()` after the rider grants it.
export function useStands(options: { refetchInterval?: number; enabled?: boolean } = {}) {
  const { ctx } = useSession();
  const [fix, setFix] = useState<GeoFix | null>(cachedFix);
  const [located, setLocated] = useState(false);

  const locate = async () => {
    if (!ctx) return;
    const next = await getFixIfAllowed(ctx);
    setFix(next);
    setLocated(true);
  };

  useEffect(() => {
    void locate();
    // Once per rider: the fix is cached for 60 s by the location module.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.profile.id]);

  const query = useQuery({
    queryKey: ['stands', round3(fix?.lat), round3(fix?.lng)],
    queryFn: () => getStands(db, fix),
    enabled: !!ctx && located && options.enabled !== false,
    refetchInterval: options.refetchInterval,
  });

  return { ...query, fix, hasFix: typeof fix?.lat === 'number', locate };
}
