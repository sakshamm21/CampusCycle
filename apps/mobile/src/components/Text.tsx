import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { font, type } from '@campuscycle/shared';
import { useTheme } from '../theme/ThemeProvider.tsx';

export type TextVariant =
  | 'displayXL'
  | 'displayL'
  | 'displayM'
  | 'displayS'
  | 'numericXL'
  | 'numericL'
  | 'numericM'
  | 'bodyL'
  | 'body'
  | 'bodyS'
  | 'label'
  | 'labelL'
  | 'button';

export type TextTone = 'fg' | 'muted' | 'subtle' | 'primary' | 'ok' | 'warn' | 'bad';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  upper?: boolean;
}

export function Text({ variant = 'body', tone = 'fg', upper, style, children, ...rest }: TextProps) {
  const { c } = useTheme();

  const [fontSize, lineHeight, letterSpacingEm] = type[variant];
  const isLabel = variant === 'label' || variant === 'labelL';
  const shouldUpper = upper ?? isLabel;

  let fontFamily: string = font.body;
  if (variant.startsWith('display')) {
    fontFamily = font.display;
  } else if (variant.startsWith('numeric')) {
    fontFamily = font.numeric;
  } else if (isLabel) {
    fontFamily = font.mono;
  } else if (variant === 'button') {
    fontFamily = font.displayBold;
  }

  const textColor = c[tone] ?? c.fg;
  const isNumeric = variant.startsWith('numeric');

  const computedStyle = {
    fontFamily,
    fontSize,
    lineHeight,
    letterSpacing: fontSize * letterSpacingEm,
    color: textColor,
    ...(isNumeric ? { fontVariant: ['tabular-nums' as const] } : {}),
  };

  let content = children;
  if (shouldUpper && typeof children === 'string') {
    content = children.toUpperCase();
  }

  return (
    <RNText maxFontSizeMultiplier={1.3} style={[computedStyle, style]} {...rest}>
      {content}
    </RNText>
  );
}
