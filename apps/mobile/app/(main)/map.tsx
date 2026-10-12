import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useRouter } from 'expo-router';
import { Crosshair } from 'lucide-react-native';
import { en, formatDistance, t, walkMinutes, type StandWithCounts } from '@campuscycle/shared';
import { useSession } from '@/lib/session';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Headline } from '@/components/Headline';
import { IconButton } from '@/components/IconButton';
import { Kicker } from '@/components/Kicker';
import { Pill } from '@/components/Pill';
import { DOCK_SPACE, Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Skeleton, useDelayedLoading } from '@/components/Skeleton';
import { ErrorState } from '@/components/States';
import { toneForFree } from '@/components/StandPin';
import { Text } from '@/components/Text';
import { StandMap, type StandMapHandle } from '@/features/stands';
import { useStands } from '@/features/stands/useStands';
import { useTheme } from '@/theme/ThemeProvider';

type Mode = 'map' | 'list';
const MODE_KEY = 'cc-map-mode';

function distanceLine(stand: StandWithCounts): string {
  return stand.distance_m === null
    ? ''
    : t('r09.walk', { distance: formatDistance(stand.distance_m), min: walkMinutes(stand.distance_m) });
}

// R09 Map and stand list
export default function MapScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { ctx } = useSession();
  const focused = useIsFocused();
  const stands = useStands({ refetchInterval: focused ? 30_000 : undefined });
  const map = useRef<StandMapHandle>(null);
  const [mode, setMode] = useState<Mode>('map');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const showSkeleton = useDelayedLoading(stands.isPending);

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY).then((v) => {
      if (v === 'map' || v === 'list') setMode(v);
    });
  }, []);

  const changeMode = (next: Mode) => {
    setMode(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  };

  const rows = useMemo(() => stands.data ?? [], [stands.data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((s) => s.name.toLowerCase().includes(q)) : rows;
  }, [rows, search]);
  const selected = rows.find((s) => s.id === selectedId) ?? null;

  // Centre on the rider when there is a fix, else on the college, else on the first stand.
  const fix = stands.fix;
  const home =
    typeof fix?.lat === 'number' && typeof fix.lng === 'number'
      ? { lat: fix.lat, lng: fix.lng }
      : typeof ctx?.college?.center_lat === 'number' && typeof ctx.college.center_lng === 'number'
        ? { lat: ctx.college.center_lat, lng: ctx.college.center_lng }
        : rows[0]
          ? { lat: rows[0].lat, lng: rows[0].lng }
          : null;

  const open = (id: string) => router.push(`/stand/${id}`);

  return (
    <Screen
      dock={mode === 'list'}
      scroll={mode === 'list'}
      testID="r09"
      onRefresh={mode === 'list' ? () => void stands.refetch() : undefined}
      refreshing={stands.isRefetching}
      contentStyle={mode === 'map' ? { paddingBottom: DOCK_SPACE + 16 } : undefined}
    >
      <Headline text={en.r09.title} size="l" />
      <Segmented
        value={mode}
        onChange={changeMode}
        options={[
          { value: 'map', label: en.r09.map, testID: 'r09.map' },
          { value: 'list', label: en.r09.list, testID: 'r09.list' },
        ]}
      />

      {stands.error ? (
        <ErrorState error={stands.error} onRetry={() => void stands.refetch()} />
      ) : stands.isPending ? (
        showSkeleton ? (
          <>
            <Skeleton height={72} round={22} />
            <Skeleton height={72} round={22} />
            <Skeleton height={72} round={22} />
          </>
        ) : null
      ) : rows.length === 0 ? (
        <Text variant="body" tone="muted">
          {en.r09.empty}
        </Text>
      ) : mode === 'map' && home ? (
        <View style={{ flex: 1 }}>
          <StandMap
            ref={map}
            stands={rows}
            center={home}
            selectedId={selectedId}
            onSelect={setSelectedId}
            showUser={stands.hasFix}
          />
          <IconButton
            testID="r09.recenter"
            icon={Crosshair}
            label={en.r09.recenter}
            onPress={() => map.current?.recenter(home)}
            style={{ position: 'absolute', right: 12, bottom: selected ? 124 : 12 }}
          />
          {selected ? (
            <Card
              variant="raised"
              testID="r09.selected"
              style={{ position: 'absolute', left: 8, right: 8, bottom: 8 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="displayS">{selected.name.toLowerCase()}</Text>
                  <Kicker
                    text={[distanceLine(selected), t('r08.free', { n: selected.free_bikes })]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                </View>
                <Pill testID="r09.open" size="sm" label={en.r09.open} onPress={() => open(selected.id)} />
              </View>
            </Card>
          ) : null}
        </View>
      ) : (
        <>
          <Field
            testID="r09.search"
            label={en.r09.search}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {filtered.map((s, i) => (
            <Pressable
              key={s.id}
              testID={`r09.stand.${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${s.name}, ${t('r08.free', { n: s.free_bikes })}`}
              onPress={() => open(s.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 72,
                padding: 14,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.surface,
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="displayS">{s.name.toLowerCase()}</Text>
                {s.distance_m !== null ? <Kicker text={distanceLine(s)} /> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="numericM" tone={toneForFree(s.free_bikes)}>
                  {String(s.free_bikes)}
                </Text>
                <Text variant="label" tone="muted">
                  {en.r09.free}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}
