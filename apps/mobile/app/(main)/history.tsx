import React, { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { en, formatDay, formatDuration, formatMonth, listMyRides, t } from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { Chip } from '@/components/Chip';
import { Headline } from '@/components/Headline';
import { Kicker } from '@/components/Kicker';
import { DOCK_SPACE, Screen } from '@/components/Screen';
import { Skeleton, useDelayedLoading } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/States';
import { Text } from '@/components/Text';
import { NextFinishCard } from '@/features/pass/NextFinishCard';
import { usePassStats } from '@/features/pass/passData';
import { useTheme } from '@/theme/ThemeProvider';

const PAGE = 20;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="numericM" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="label" tone="muted">
        {label}
      </Text>
    </View>
  );
}

// R15 History (`(main)/history`)
export default function History() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { ctx } = useSession();
  const stats = usePassStats(!!ctx);
  const rides = useInfiniteQuery({
    queryKey: ['rides'],
    queryFn: ({ pageParam }) => listMyRides(db, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length === PAGE ? pages.length : undefined),
    enabled: !!ctx,
  });
  const showSkeleton = useDelayedLoading(rides.isPending);
  const tz = ctx?.college?.time_zone ?? 'UTC';

  // Each row knows whether it starts a new month, for the month kickers.
  const rows = useMemo(() => {
    const all = rides.data?.pages.flat() ?? [];
    return all.map((ride, i) => {
      const month = formatMonth(ride.started_at, tz);
      const previous = all[i - 1];
      return { ride, month: !previous || formatMonth(previous.started_at, tz) !== month ? month : null };
    });
  }, [rides.data, tz]);

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <Headline text={en.r15.h_title} size="l" />
      {stats.data ? (
        <>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Stat value={String(stats.data.rides)} label={en.r15.rides} />
            <Stat value={String(stats.data.minutes)} label={en.r15.minutes} />
            <Stat value={stats.data.fave_stand ?? en.pass.none} label={en.r15.fave} />
          </View>
          <NextFinishCard stats={stats.data} />
        </>
      ) : (
        <Skeleton height={180} round={26} />
      )}
      {rides.error ? <ErrorState error={rides.error} onRetry={() => void rides.refetch()} /> : null}
      {showSkeleton ? (
        <>
          <Skeleton height={64} round={22} />
          <Skeleton height={64} round={22} />
        </>
      ) : null}
      {!rides.isPending && !rides.error && rows.length === 0 ? (
        <EmptyState
          sticker={en.r15.first_q}
          rotate={-4}
          title={en.r15.empty}
          action={{
            label: en.r15.borrow,
            onPress: () => router.push('/scan?mode=borrow'),
            testID: 'r15.borrow',
          }}
        />
      ) : null}
    </View>
  );

  return (
    <Screen scroll={false} testID="r15.history" contentStyle={{ paddingBottom: 0 }}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.ride.id}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: DOCK_SPACE + insets.bottom + 16 }}
        onEndReached={() => {
          if (rides.hasNextPage && !rides.isFetchingNextPage) void rides.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={rides.isRefetching && !rides.isFetchingNextPage}
            onRefresh={() => void rides.refetch()}
            tintColor={c.primary}
            colors={[c.primary]}
          />
        }
        renderItem={({ item: { ride, month } }) => {
          const minutes = ride.ended_at
            ? Math.max(
                1,
                Math.round(
                  (new Date(ride.ended_at).getTime() - new Date(ride.started_at).getTime()) / 60_000,
                ),
              )
            : 0;
          return (
            <View>
              {month ? <Kicker text={month} style={{ paddingTop: 12, paddingBottom: 4 }} /> : null}
              <Pressable
                testID={`r15.ride.${ride.id}`}
                accessibilityRole="button"
                onPress={() => router.push(`/ride/${ride.id}`)}
                style={{
                  minHeight: 64,
                  paddingVertical: 10,
                  gap: 4,
                  borderBottomWidth: 1,
                  borderBottomColor: c.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text variant="label" tone="muted" style={{ width: 52 }}>
                    {formatDay(ride.started_at, tz)}
                  </Text>
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {t('r15.route', { from: ride.start?.name ?? '', to: ride.end?.name ?? '' })}
                  </Text>
                  <Text variant="bodyS" tone="muted">
                    {formatDuration(minutes)}
                  </Text>
                </View>
                {ride.late || ride.status === 'force_returned' ? (
                  <View style={{ flexDirection: 'row', gap: 6, paddingLeft: 64 }}>
                    {ride.late ? <Chip text={en.r15.chip_late} tone="warn" /> : null}
                    {ride.status === 'force_returned' ? (
                      <Chip text={en.r15.chip_forced} tone="subtle" />
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            </View>
          );
        }}
      />
    </Screen>
  );
}
