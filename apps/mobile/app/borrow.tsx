import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  borrowBike,
  en,
  previewBike,
  relativeTime,
  t,
  toAppError,
  type AppError,
  type BorrowPreview,
  type GeoFix,
} from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { getFix } from '@/lib/location';
import { useSession } from '@/lib/session';
import { useOnline } from '@/components/Banner';
import { Card } from '@/components/Card';
import { Headline } from '@/components/Headline';
import { Kicker } from '@/components/Kicker';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { SlideToConfirm } from '@/components/SlideToConfirm';
import { ErrorState } from '@/components/States';
import { Steps } from '@/components/Steps';
import { Text } from '@/components/Text';
import { rideErrorActions } from '@/features/ride/rideErrors';

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; preview: BorrowPreview; fix: GeoFix }
  | { phase: 'error'; error: AppError };

// R12 Borrow (`?code=&sig=`)
export default function Borrow() {
  const { code = '', sig = '' } = useLocalSearchParams<{ code?: string; sig?: string }>();
  const router = useRouter();
  const online = useOnline();
  const { ctx, refresh } = useSession();
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [borrowing, setBorrowing] = useState(false);

  const load = useCallback(async () => {
    if (!ctx) return;
    setState({ phase: 'loading' });
    try {
      const fix = await getFix(ctx);
      const preview = await previewBike(db, code, sig, fix);
      setState({ phase: 'ready', preview, fix });
    } catch (e) {
      setState({ phase: 'error', error: toAppError(e) });
    }
    // The preview belongs to this rider and this bike, not to every context refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.profile.id, code, sig]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = async () => {
    if (state.phase !== 'ready') return;
    setBorrowing(true);
    try {
      // The fix from the preview is under a minute old, so it is reused.
      await borrowBike(db, code, sig, state.fix);
      await refresh();
      router.replace('/riding?docked=1');
    } catch (e) {
      setState({ phase: 'error', error: toAppError(e) });
      setBorrowing(false);
    }
  };

  const demo = !!ctx?.profile.is_demo;

  return (
    <Screen
      header={{}}
      testID="r12"
      footer={
        state.phase === 'ready' ? (
          <SlideToConfirm
            testID="r12.slide"
            label={en.r12.slide}
            loading={borrowing}
            disabled={!online}
            onConfirm={() => void confirm()}
          />
        ) : undefined
      }
    >
      {state.phase === 'loading' ? (
        <>
          <Kicker text={en.r12.checking} />
          <Skeleton height={44} width="80%" />
          <Skeleton height={140} round={26} />
        </>
      ) : state.phase === 'error' ? (
        <ErrorState
          error={state.error}
          {...rideErrorActions(state.error, {
            router,
            retry: () => void load(),
            bikeCode: code,
            scanMode: 'borrow',
          })}
        />
      ) : (
        <>
          <Kicker
            live
            text={t(demo ? 'r12.demo_range' : 'r12.in_range', { stand: state.preview.stand.name })}
            testID="r12.in_range"
          />
          <Headline text={t('r12.title', { code: state.preview.bike.code })} size="xl" />
          <Card variant="raised" testID="r12.bike">
            <View style={{ gap: 8 }}>
              <Text variant="numericL">{state.preview.bike.code}</Text>
              {state.preview.bike.last_seen_at ? (
                <Kicker
                  text={t('r12.checked', { relative: relativeTime(state.preview.bike.last_seen_at) })}
                />
              ) : null}
              {state.preview.bike.notes ? <Text variant="body">{state.preview.bike.notes}</Text> : null}
            </View>
          </Card>
          <Steps
            steps={[
              { text: en.r12.pass_free, status: 'done' },
              { text: t('r12.at_stand', { stand: state.preview.stand.name }), status: 'done' },
              ...(state.preview.manual ? [{ text: en.r12.manual, status: 'warn' as const }] : []),
            ]}
          />
          <Text variant="bodyS" tone="muted">
            {t('r12.terms', { hours: Number((state.preview.max_ride_minutes / 60).toFixed(1)) })}
          </Text>
        </>
      )}
    </Screen>
  );
}
