import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Check, CircleAlert } from 'lucide-react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { alpha } from '@/theme/color';

export type StepStatus = 'done' | 'warn' | 'busy' | 'todo';

export interface Step {
  text: string;
  status: StepStatus;
  testID?: string;
}

function Mark({ status }: { status: StepStatus }) {
  const { c } = useTheme();
  const color = status === 'done' ? c.ok : status === 'warn' ? c.warn : c.subtle;
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: color,
        backgroundColor: status === 'done' || status === 'warn' ? alpha(color, 0.14) : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {status === 'done' ? <Check size={14} color={color} strokeWidth={3} /> : null}
      {status === 'warn' ? <CircleAlert size={14} color={color} strokeWidth={2.5} /> : null}
      {status === 'busy' ? <ActivityIndicator size={12} color={c.muted} /> : null}
    </View>
  );
}

/** The board's `.steps` list: a tick, a warning, a spinner or an empty ring per row. */
export function Steps({ steps, horizontal }: { steps: Step[]; horizontal?: boolean }) {
  return (
    <View style={horizontal ? { flexDirection: 'row', gap: 12, flexWrap: 'wrap' } : { gap: 12 }}>
      {steps.map((s) => (
        <View
          key={s.text}
          testID={s.testID}
          accessible
          accessibilityLabel={s.text}
          accessibilityState={{ checked: s.status === 'done' }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: horizontal ? 6 : 12, flexShrink: 1 }}
        >
          <Mark status={s.status} />
          {horizontal ? (
            <Text variant="label" tone={s.status === 'done' ? 'fg' : 'muted'}>
              {s.text}
            </Text>
          ) : (
            <Text variant="body" tone={s.status === 'todo' ? 'muted' : 'fg'} style={{ flex: 1 }}>
              {s.text}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
