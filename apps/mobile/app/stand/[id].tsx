import React from 'react';
import { Linking, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import {
  en,
  font,
  formatDistance,
  getStandDetail,
  relativeTime,
  t,
  walkMinutes,
  type StandWithCounts,
} from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { cachedFix, haversineM } from '@/lib/location';
import { useSession } from '@/lib/session';
import { StatusPill, toneForStatus } from '@/components/Chip';
import { Headline } from '@/components/Headline';
import { IconButton } from '@/components/IconButton';
import { Kicker } from '@/components/Kicker';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Skeleton, useDelayedLoading } from '@/components/Skeleton';
import { ErrorState } from '@/components/States';
import { Text } from '@/components/Text';
import { StandMap } from '@/features/stands';
import { passDisplayState } from '@/features/pass/passState';
import { useTheme } from '@/theme/ThemeProvider';

// R10 Stand detail
export default function StandDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const { ctx } = useSession();
  const queryClient = useQueryClient();
  const stand = useQuery({ queryKey: ['stand', id], queryFn: () => getStandDetail(db, id), enabled: !!id });
  const showSkeleton = useDelayedLoading(stand.isPending);

  const state = ctx ? passDisplayState(ctx) : 'pending';
  const canBorrow = state === 'ready' || state === 'minting';

  // Distance from the stand list cache, or from the last fix.
  const distance = (() => {
    const lists = queryClient.getQueriesData<StandWithCounts[]>({ queryKey: ['stands'] });
    for (const [, list] of lists) {
      const hit = list?.find((s) => s.id === id);
      if (hit && hit.distance_m !== null) return hit.distance_m;
    }
    const fix = cachedFix();
    if (stand.data && typeof fix?.lat === 'number' && typeof fix.lng === 'number') {
      return haversineM({ lat: fix.lat, lng: fix.lng }, stand.data);
    }
    return null;
  })();

  const data = stand.data;
  const bikes = (data?.bikes ?? []).filter((b) => b.status === 'available' || b.status === 'maintenance');
  const free = bikes.filter((b) => b.status === 'available').length;

  return (
    <Screen
      testID="r10"
      header={{
        right: (
          <IconButton
            testID="r10.report"
            icon={TriangleAlert}
            label={en.r10.report}
            onPress={() => router.push(`/report?stand=${id}`)}
          />
        ),
      }}
      footer={
        data ? (
          <>
            {canBorrow ? null : (
              <Text variant="bodyS" tone="muted">
                {en.r10.not_ready}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pill
                testID="r10.directions"
                variant="secondary"
                label={en.r10.directions}
                style={{ flex: 1 }}
                block
                onPress={() =>
                  void Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${data.lat},${data.lng}&travelmode=walking`,
                  )
                }
              />
              <Pill
                testID="r10.borrow_here"
                label={en.r10.borrow_here}
                style={{ flex: 1 }}
                block
                disabled={!canBorrow}
                onPress={() => router.push('/scan?mode=borrow')}
              />
            </View>
          </>
        ) : undefined
      }
    >
      {stand.error ? (
        <ErrorState error={stand.error} onRetry={() => void stand.refetch()} />
      ) : !data ? (
        showSkeleton ? (
          <>
            <Skeleton height={34} width="70%" />
            <Skeleton height={80} round={22} />
            <Skeleton height={160} round={22} />
          </>
        ) : null
      ) : (
        <>
          {distance !== null ? (
            <Kicker
              text={t('r10.kicker', { distance: formatDistance(distance), walk: walkMinutes(distance) })}
            />
          ) : null}
          <Headline text={data.name} size="l" />
          <View style={{ flexDirection: 'row', gap: 24 }}>
            <View>
              <Text testID="r10.free" variant="numericL" tone="ok">
                {String(free)}
              </Text>
              <Text variant="label" tone="muted">
                {en.r10.free}
              </Text>
            </View>
            <View>
              <Text variant="numericL" tone="muted">
                {String(data.capacity)}
              </Text>
              <Text variant="label" tone="muted">
                {en.r10.capacity}
              </Text>
            </View>
          </View>
          <StandMap
            stands={[{ id: data.id, name: data.name, lat: data.lat, lng: data.lng, free_bikes: free }]}
            center={{ lat: data.lat, lng: data.lng }}
            interactive={false}
            height={160}
            radius={22}
          />
          {bikes.length === 0 ? (
            <Text variant="body" tone="muted">
              {en.r10.empty_bikes}
            </Text>
          ) : (
            bikes.map((b) => (
              <View
                key={b.id}
                testID={`r10.bike.${b.code}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 52,
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: c.border,
                }}
              >
                <Text variant="labelL" style={{ fontFamily: font.monoBold }}>
                  {b.code}
                </Text>
                <StatusPill
                  text={b.status === 'available' ? en.r10.status_available : en.r10.status_maintenance}
                  tone={toneForStatus(b.status)}
                />
                <View style={{ flex: 1 }} />
                {b.last_seen_at ? (
                  <Text variant="bodyS" tone="muted">
                    {t('r10.seen', { relative: relativeTime(b.last_seen_at) })}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </>
      )}
    </Screen>
  );
}
