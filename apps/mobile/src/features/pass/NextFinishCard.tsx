import React from 'react';
import { View } from 'react-native';
import { FINISH_THRESHOLDS, en, t, type PassStats } from '@campuscycle/shared';
import { Card } from '@/components/Card';
import { Kicker } from '@/components/Kicker';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { finishName } from './passData';

export function ProgressBar({
  value,
  tone = 'primary',
}: {
  value: number;
  tone?: 'primary' | 'ok' | 'warn' | 'bad';
}) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height: 6, borderRadius: 3, backgroundColor: c.surface2, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct * 100}%`, height: 6, borderRadius: 3, backgroundColor: c[tone] }} />
    </View>
  );
}

/** "{n} more rides to unlock {finish}", or the Holo line once there (04 R08 card 6). */
export function nextFinishLine(stats: Pick<PassStats, 'next_finish' | 'rides_to_next'>): string {
  return stats.next_finish
    ? t('r08.rides_to', { n: stats.rides_to_next, finish: finishName(stats.next_finish) })
    : en.r08.max_finish;
}

export function NextFinishCard({ stats }: { stats: PassStats }) {
  const next = stats.next_finish;
  const goal = next ? FINISH_THRESHOLDS[next === 'holo' ? 'holo' : 'chrome'] : stats.rides;
  return (
    <Card testID="r08.next_finish">
      <View style={{ gap: 8 }}>
        <Kicker text={en.r08.next_finish} />
        <Text variant="displayM">{finishName(next ?? stats.finish).toLowerCase()}</Text>
        <Text variant="bodyS" tone="muted">
          {nextFinishLine(stats)}
        </Text>
        <ProgressBar value={goal > 0 ? stats.rides / goal : 1} />
      </View>
    </Card>
  );
}
