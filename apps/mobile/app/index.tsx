import React from 'react';
import { Screen } from '@/components/Screen';
import { ErrorState } from '@/components/States';
import { BrandMark } from '@/components/BrandMark';
import { Pill } from '@/components/Pill';
import { en } from '@campuscycle/shared';
import { useSession } from '@/lib/session';

// The launch route. The gate (GateKeeper) replaces it as soon as the session is known; it only stays
// on screen when the rider's context could not be loaded.
export default function Index() {
  const { error, refresh, signOut } = useSession();
  return (
    <Screen scroll={false} banners={false} testID="launch" contentStyle={{ justifyContent: 'center' }}>
      {error ? (
        <>
          <ErrorState error={error} onRetry={() => void refresh()} />
          <Pill variant="ghost" size="sm" label={en.r19.sign_out} onPress={() => void signOut()} />
        </>
      ) : (
        <BrandMark size={56} />
      )}
    </Screen>
  );
}
