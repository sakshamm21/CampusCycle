import React, { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { en, parseQr } from '@campuscycle/shared';
import { useSession } from '@/lib/session';
import { useToast } from '@/components/Toast';
import { passDisplayState } from '@/features/pass/passState';

// Deep link handler: `campuscycle://b/K-042?s=…` from the phone's own camera (03 §5).
export default function BikeLink() {
  const { code, s } = useLocalSearchParams<{ code: string; s?: string }>();
  const { ctx, status } = useSession();
  const toast = useToast();

  const parsed = parseQr(`campuscycle://b/${code}?s=${s ?? ''}`);
  const state = ctx ? passDisplayState(ctx) : null;
  const ready = parsed.kind === 'bike' && (state === 'ready' || state === 'minting');

  useEffect(() => {
    if (status === 'signedIn' && ctx && !ready) toast.show(en.r12.deeplink_not_ready, 'warn');
  }, [status, ctx, ready, toast]);

  // Signed out or still loading: the gate takes over.
  if (status !== 'signedIn' || !ctx) return null;
  if (ready && parsed.kind === 'bike') {
    return <Redirect href={{ pathname: '/borrow', params: { code: parsed.code, sig: parsed.sig } }} />;
  }
  return <Redirect href="/(main)" />;
}
