import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import {
  en,
  formatDistance,
  formatDuration,
  listNotifications,
  markPassMintedSeen,
  t,
  timeLeft,
  walkMinutes,
  type StandWithCounts,
} from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useNow } from '@/hooks/useNow';
import { Card } from '@/components/Card';
import { Headline } from '@/components/Headline';
import { IconButton } from '@/components/IconButton';
import { Kicker } from '@/components/Kicker';
import { RiderPass } from '@/components/RiderPass';
import { Screen } from '@/components/Screen';
import { Skeleton, useDelayedLoading } from '@/components/Skeleton';
import { ErrorState } from '@/components/States';
import { toneForFree } from '@/components/StandPin';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { NextFinishCard, ProgressBar } from '@/features/pass/NextFinishCard';
import { firstName, passProps, usePassQr, usePassStats } from '@/features/pass/passData';
import { passDisplayState } from '@/features/pass/passState';
import { useStands } from '@/features/stands/useStands';

function RideStrip({ bike, dueAt, onPress }: { bike: string; dueAt: string; onPress(): void }) {
  const now = useNow(30_000);
  const left = timeLeft(dueAt, new Date(now));
  const minutes = formatDuration(left.ms / 60_000);
  return (
    <Card testID="r08.ride_strip" onPress={onPress} accessibilityLabel={`${en.r08.on_pass} ${bike}`}>
      <View style={{ gap: 6 }}>
        <Kicker text={en.r08.on_pass} live />
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}
        >
          <Text variant="numericM">{bike}</Text>
          <Text variant="bodyS" tone={left.overdue ? 'warn' : 'muted'}>
            {left.overdue ? t('r08.over', { over: minutes }) : t('r08.left', { left: minutes })}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function NearestStand({
  stands,
  hasFix,
  canAskLocation,
  onTurnOnLocation,
  onOpen,
}: {
  stands: StandWithCounts[];
  hasFix: boolean;
  canAskLocation: boolean;
  onTurnOnLocation(): void;
  onOpen(id: string): void;
}) {
  const stand = stands[0];
  if (!stand) {
    return (
      <Card>
        <Text variant="body" tone="muted">
          {en.r09.empty}
        </Text>
      </Card>
    );
  }
  const anyFree = stands.some((s) => s.free_bikes > 0);
  return (
    <Card testID="r08.nearest" onPress={() => onOpen(stand.id)} accessibilityLabel={stand.name}>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Kicker
            text={
              hasFix && stand.distance_m !== null
                ? t('r08.nearest', { distance: formatDistance(stand.distance_m) })
                : en.r08.nearest_noloc
            }
          />
          {hasFix && stand.distance_m !== null ? (
            <Text variant="label" tone="muted">
              {t('r08.walk', { min: walkMinutes(stand.distance_m) })}
            </Text>
          ) : null}
        </View>
        <Text variant="displayL">{stand.name.toLowerCase()}</Text>
        {anyFree ? (
          <Text variant="body" tone={toneForFree(stand.free_bikes)}>
            {t('r08.free', { n: stand.free_bikes })}
          </Text>
        ) : (
          <Text variant="body" tone="warn">
            {en.r08.none_free}
          </Text>
        )}
        <ProgressBar
          value={stand.capacity > 0 ? stand.free_bikes / stand.capacity : 0}
          tone={toneForFree(stand.free_bikes)}
        />
        {!hasFix && canAskLocation ? (
          <Pressable
            testID="r08.turn_on_loc"
            accessibilityRole="link"
            hitSlop={12}
            onPress={onTurnOnLocation}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text variant="bodyS" tone="primary">
              {en.r08.turn_on_loc}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

// R08 Home: the Rider Pass
export default function Home() {
  const router = useRouter();
  const toast = useToast();
  const { ctx, error, refresh } = useSession();
  const [flipped, setFlipped] = useState(false);
  const stands = useStands();
  const stats = usePassStats(!!ctx);
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications(db),
    enabled: !!ctx,
  });
  const showSkeleton = useDelayedLoading(!ctx && !error);

  const state = ctx ? passDisplayState(ctx) : 'pending';
  const hasQr = state === 'ready' || state === 'riding' || state === 'overdue';
  const qr = usePassQr(flipped && hasQr);

  if (!ctx) {
    return (
      <Screen dock testID="r08">
        {error ? <ErrorState error={error} onRetry={() => void refresh()} /> : null}
        {showSkeleton ? (
          <>
            <Skeleton aspectRatio={1.586} round={24} />
            <Skeleton height={120} round={26} />
            <Skeleton height={120} round={26} />
          </>
        ) : null}
      </Screen>
    );
  }

  const first = firstName(ctx);
  const riding = state === 'riding' || state === 'overdue';
  const unread = (notifications.data ?? []).filter((n) => n.read_at === null).length;
  const title = riding
    ? t('r08.riding', { bike: ctx.ride?.bike_code ?? '' })
    : state === 'minting'
      ? t('r08.minted', { first })
      : t('r08.hey', { first });

  const onMinted = async () => {
    try {
      await markPassMintedSeen(db);
      toast.show(en.r08.mint_toast, 'ok');
    } finally {
      await refresh();
    }
  };

  const turnOnLocation = async () => {
    await Location.requestForegroundPermissionsAsync();
    await stands.locate();
  };

  return (
    <Screen dock testID="r08">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Kicker text={ctx.college?.name ?? ''} style={{ flex: 1 }} />
        <IconButton
          testID="r08.inbox"
          icon={Bell}
          label={en.r08.inbox}
          badge={unread}
          onPress={() => router.push('/notifications')}
        />
      </View>
      <Headline text={title} size="xl" />
      <RiderPass
        {...passProps(ctx, state)}
        interactive
        onFlip={setFlipped}
        qr={qr}
        stats={stats.data}
        onMinted={() => void onMinted()}
        testID="r08.pass"
      />

      {riding && ctx.ride ? (
        <RideStrip bike={ctx.ride.bike_code} dueAt={ctx.ride.due_at} onPress={() => router.push('/riding')} />
      ) : stands.error ? (
        <ErrorState error={stands.error} onRetry={() => void stands.refetch()} />
      ) : stands.data ? (
        <NearestStand
          stands={stands.data}
          hasFix={stands.hasFix}
          canAskLocation={!ctx.profile.is_demo}
          onTurnOnLocation={() => void turnOnLocation()}
          onOpen={(id) => router.push(`/stand/${id}`)}
        />
      ) : (
        <Skeleton height={140} round={26} />
      )}

      {stats.data ? <NextFinishCard stats={stats.data} /> : <Skeleton height={120} round={26} />}
    </Screen>
  );
}
