import React, { useEffect, useRef, useState } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  en,
  font,
  formatClock,
  formatDay,
  formatRideClock,
  getRide,
  nextFinish,
  t,
} from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import { BrandMark } from '@/components/BrandMark';
import { Chip } from '@/components/Chip';
import { Headline } from '@/components/Headline';
import { Pill } from '@/components/Pill';
import { Receipt } from '@/components/Receipt';
import { RiderPass } from '@/components/RiderPass';
import { Screen } from '@/components/Screen';
import { Skeleton, useDelayedLoading } from '@/components/Skeleton';
import { ErrorState } from '@/components/States';
import { Steps } from '@/components/Steps';
import { Sticker } from '@/components/Sticker';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { finishName, firstName, passProps } from '@/features/pass/passData';
import { useReturnFlow } from '@/features/ride/ReturnFlowProvider';
import { shareReceipt } from '@/features/ride/shareReceipt';
import { useTheme } from '@/theme/ThemeProvider';

interface Summary {
  bike: string;
  from: string;
  to: string;
  startedAt: string;
  endedAt: string;
  late: boolean;
}

function Row({ text, tone }: { text: string; tone?: 'warn' | 'bad' | 'muted' }) {
  return (
    <Text variant="bodyS" tone={tone ?? 'fg'}>
      {text}
    </Text>
  );
}

// R15 Ride summary (`ride/[id]`, `?fresh=1` right after a return)
export default function RideSummary() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { c } = useTheme();
  const screen = useWindowDimensions();
  const { ctx } = useSession();
  const flow = useReturnFlow();
  const clearFlow = flow.clear;
  const shot = useRef<View>(null);

  // The result is read once: the context is cleared when this screen goes away.
  const [result] = useState(() => (fresh === '1' && flow.result?.ride_id === id ? flow.result : null));
  const [stamped, setStamped] = useState(!!result);
  const ride = useQuery({ queryKey: ['ride', id], queryFn: () => getRide(db, id), enabled: !!id && !result });
  const showSkeleton = useDelayedLoading(!result && ride.isPending);

  useEffect(() => {
    if (!result) return;
    void queryClient.invalidateQueries({ queryKey: ['rides'] });
    void queryClient.invalidateQueries({ queryKey: ['passStats'] });
    void queryClient.invalidateQueries({ queryKey: ['stands'] });
    // The stamp stays 2.5 s, then the pass is ready again.
    const timer = setTimeout(() => setStamped(false), 2500);
    const levelled = result.finish_after !== result.finish_before;
    const level = levelled
      ? setTimeout(() => {
          haptic.success();
          toast.show(t('pass.level_up', { finish: finishName(result.finish_after) }), 'ok');
        }, 600)
      : undefined;
    return () => {
      clearTimeout(timer);
      clearTimeout(level);
    };
  }, [result, queryClient, toast]);

  useEffect(() => () => clearFlow(), [clearFlow]);

  if (!ctx) return <Screen header={{}}>{null}</Screen>;
  const tz = ctx.college?.time_zone ?? 'UTC';

  const summary: Summary | null = result
    ? {
        bike: result.bike_code,
        from: result.start_stand_name,
        to: result.end_stand_name,
        startedAt: result.started_at,
        endedAt: result.ended_at,
        late: result.late,
      }
    : ride.data && ride.data.ended_at
      ? {
          bike: ride.data.bike?.short_code ?? '',
          from: ride.data.start?.name ?? '',
          to: ride.data.end?.name ?? '',
          startedAt: ride.data.started_at,
          endedAt: ride.data.ended_at,
          late: ride.data.late,
        }
      : null;

  if (!summary) {
    return (
      <Screen header={{}} testID="r15">
        {ride.error ? <ErrorState error={ride.error} onRetry={() => void ride.refetch()} /> : null}
        {showSkeleton ? <Skeleton height={320} round={22} /> : null}
      </Screen>
    );
  }

  const ms = new Date(summary.endedAt).getTime() - new Date(summary.startedAt).getTime();
  const minutes = result?.minutes ?? Math.max(1, Math.round(ms / 60_000));
  const progress = result ? nextFinish(result.total_rides) : null;
  const check = ride.data?.photo_check;
  const photoChip =
    check === 'ok'
      ? { text: en.r15.photo_ok, tone: 'ok' as const }
      : check === 'unclear' || check === 'failed'
        ? { text: en.r15.photo_flagged, tone: 'warn' as const }
        : check === 'pending'
          ? { text: en.r15.photo_pending, tone: 'muted' as const }
          : null;

  const share = async () => {
    const text = t('r15.share_text', { minutes, from: summary.from, to: summary.to });
    const outcome = await shareReceipt(shot, text);
    if (outcome === 'copied') toast.show(en.common.copied, 'ok');
  };

  const done = () => router.dismissTo('/(main)');

  return (
    <Screen
      testID="r15"
      header={{ onBack: done }}
      footer={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pill testID="r15.share" variant="secondary" label={en.r15.share} onPress={() => void share()} />
          <Pill testID="r15.done" size="lg" label={en.r15.done} style={{ flex: 1 }} onPress={done} />
        </View>
      }
    >
      {result ? (
        <Steps
          horizontal
          steps={[
            { text: t('r15.at', { stand: summary.to }), status: 'done' },
            { text: summary.bike, status: 'done' },
            result.photo_pending
              ? { text: en.r15.photo_later, status: 'busy' }
              : { text: en.r15.photo, status: 'done' },
          ]}
        />
      ) : null}

      {/* Everything inside this view is what Share captures. */}
      <View ref={shot} collapsable={false} style={{ gap: 12, backgroundColor: c.bg, paddingVertical: 4 }}>
        {result ? (
          <RiderPass
            {...passProps(ctx, stamped ? 'returned' : 'ready')}
            finish={result.finish_before}
            levelUpTo={result.finish_after}
            rides={result.total_rides}
            returnedStamp={{ stand: summary.to, minutes }}
            width={Math.min(440, screen.width - 32) * 0.7}
            testID="r15.pass"
          />
        ) : null}
        <Headline text={t('r15.title', { first: firstName(ctx) })} size="xl" />
        <View>
          <Receipt
            testID="r15.receipt"
            top={
              <View style={{ gap: 8 }}>
                <Text variant="label" style={{ color: c.onPrimary }}>
                  {t('r15.kicker', { bike: summary.bike })}
                </Text>
                <Text variant="numericL" style={{ color: c.onPrimary }} testID="r15.duration">
                  {formatRideClock(ms)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text
                    variant="bodyS"
                    style={{ color: c.onPrimary, fontFamily: font.bodyBold, flexShrink: 1 }}
                  >
                    {summary.from}
                  </Text>
                  <View
                    style={{
                      flex: 1,
                      minWidth: 16,
                      borderTopWidth: 2,
                      borderStyle: 'dashed',
                      borderColor: c.onPrimary,
                      opacity: 0.5,
                    }}
                  />
                  <Text
                    variant="bodyS"
                    style={{ color: c.onPrimary, fontFamily: font.bodyBold, flexShrink: 1 }}
                  >
                    {summary.to}
                  </Text>
                </View>
              </View>
            }
            bottom={
              <View style={{ gap: 6 }}>
                <Row
                  text={t('r15.date', {
                    date: formatDay(summary.startedAt, tz),
                    start: formatClock(summary.startedAt, tz),
                    end: formatClock(summary.endedAt, tz),
                  })}
                />
                {result ? <Row text={t('r15.ride_no', { n: result.total_rides })} /> : null}
                {progress ? (
                  <Row
                    tone="muted"
                    text={
                      progress.next
                        ? t('r08.rides_to', { n: progress.ridesToNext, finish: finishName(progress.next) })
                        : en.r08.max_finish
                    }
                  />
                ) : null}
                {result?.late ? (
                  <Row
                    tone="warn"
                    text={t('r15.late', {
                      strikes: result.strikes ?? 0,
                      limit: ctx.college?.strike_limit ?? 0,
                    })}
                  />
                ) : !result && summary.late ? (
                  <Row tone="warn" text={en.r15.late_short} />
                ) : null}
                {result?.suspended ? <Row tone="bad" text={en.r15.suspended} /> : null}
                {photoChip ? <Chip text={photoChip.text} tone={photoChip.tone} /> : null}
                {ride.data?.status === 'force_returned' ? (
                  <Row tone="muted" text={t('r15.forced', { note: ride.data.force_note ?? '' })} />
                ) : null}
              </View>
            }
          />
          {result?.total_rides === 1 ? (
            <Sticker
              text={en.r15.first}
              color="yellow"
              rotate={7}
              style={{ position: 'absolute', right: 8, top: -10 }}
            />
          ) : null}
        </View>
        {Platform.OS !== 'web' ? (
          <View style={{ alignItems: 'center', paddingTop: 4 }}>
            <BrandMark size={20} wordmark />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
