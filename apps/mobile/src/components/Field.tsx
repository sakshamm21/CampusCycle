import React, { useState } from 'react';
import { TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { en, font, radius } from '@campuscycle/shared';
import { Text } from '@/components/Text';
import { IconButton } from '@/components/IconButton';
import { useTheme } from '@/theme/ThemeProvider';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  hint?: string;
  /** Password field with an eye toggle. */
  secure?: boolean;
  /** Shown right-aligned under the input, e.g. a character counter. */
  counter?: string;
  style?: StyleProp<ViewStyle>;
}

export function Field({
  label,
  error,
  hint,
  secure,
  counter,
  multiline,
  style,
  testID,
  ...input
}: FieldProps) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={[{ gap: 6 }, style]}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View
        style={{
          minHeight: 52,
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          backgroundColor: c.surface,
          borderWidth: focused ? 1.5 : 1,
          borderColor: error ? c.bad : focused ? c.primary : c.border,
          borderRadius: radius.md,
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          placeholderTextColor={c.subtle}
          selectionColor={c.primary}
          maxFontSizeMultiplier={1.3}
          multiline={multiline}
          secureTextEntry={secure ? hidden : undefined}
          autoCapitalize={secure ? 'none' : input.autoCapitalize}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              fontFamily: font.body,
              fontSize: 15,
              color: c.fg,
              paddingVertical: multiline ? 14 : 0,
              minHeight: multiline ? 96 : 50,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            // Removes the browser's own focus ring; the border shows focus.
            { outlineStyle: 'none' } as object,
          ]}
        />
        {secure ? (
          <IconButton
            icon={hidden ? Eye : EyeOff}
            label={hidden ? en.r02.show_password : en.r02.hide_password}
            onPress={() => setHidden((h) => !h)}
            size={32}
            bare
          />
        ) : null}
      </View>
      {error || hint || counter ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Text variant="bodyS" tone={error ? 'bad' : 'subtle'} style={{ flex: 1 }}>
            {error ?? hint ?? ''}
          </Text>
          {counter ? (
            <Text variant="label" tone="subtle">
              {counter}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
