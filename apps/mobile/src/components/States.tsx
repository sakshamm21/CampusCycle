import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { CloudOff, TriangleAlert } from 'lucide-react-native';
import { en, messageFor, palette, toAppError } from '@campuscycle/shared';
import { Text } from '@/components/Text';
import { Headline } from '@/components/Headline';
import { Pill } from '@/components/Pill';
import { Sticker } from '@/components/Sticker';
import { useTheme } from '@/theme/ThemeProvider';

export interface EmptyStateProps {
  sticker: string;
  stickerColor?: keyof typeof palette.sticker;
  rotate?: number;
  /** Copy with an `*accent*` word. */
  title: string;
  body?: string;
  action?: { label: string; onPress(): void; testID?: string };
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  sticker,
  stickerColor = 'yellow',
  rotate = -4,
  title,
  body,
  action,
  style,
}: EmptyStateProps) {
  return (
    <View style={[{ alignItems: 'flex-start', gap: 12, paddingVertical: 24 }, style]}>
      <Sticker text={sticker} color={stickerColor} rotate={rotate} />
      <Headline text={title} size="m" />
      {body ? (
        <Text variant="body" tone="muted">
          {body}
        </Text>
      ) : null}
      {action ? <Pill label={action.label} onPress={action.onPress} testID={action.testID} /> : null}
    </View>
  );
}

export interface ErrorAction {
  label: string;
  onPress(): void;
  testID?: string;
}

export interface ErrorStateProps {
  /** Anything thrown: it is shown through `messageFor`, never raw. */
  error: unknown;
  /** Defaults to a "Try again" button calling `onRetry`. */
  primary?: ErrorAction;
  secondary?: ErrorAction;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ErrorState({ error, primary, secondary, onRetry, style }: ErrorStateProps) {
  const { c } = useTheme();
  const e = toAppError(error);
  const Icon = e.code === 'CC_NETWORK' ? CloudOff : TriangleAlert;
  const main = primary ?? (onRetry ? { label: en.common.try_again, onPress: onRetry } : undefined);

  return (
    <View
      testID={`error.${e.code}`}
      style={[{ alignItems: 'flex-start', gap: 12, paddingVertical: 24 }, style]}
    >
      <Icon size={28} color={c.bad} strokeWidth={2} />
      <Text variant="bodyL">{messageFor(e.code, e.data)}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {main ? <Pill label={main.label} onPress={main.onPress} testID={main.testID} /> : null}
        {secondary ? (
          <Pill
            variant="secondary"
            label={secondary.label}
            onPress={secondary.onPress}
            testID={secondary.testID}
          />
        ) : null}
      </View>
    </View>
  );
}
