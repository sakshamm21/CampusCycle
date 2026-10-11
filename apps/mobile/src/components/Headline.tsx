import React from 'react';
import { Text as RNText, type TextStyle } from 'react-native';
import { font, type } from '@campuscycle/shared';
import { useTheme } from '../theme/ThemeProvider.tsx';

export interface HeadlineProps {
  text: string;
  size?: 'xl' | 'l' | 'm';
  style?: TextStyle;
}

export function Headline({ text, size = 'xl', style }: HeadlineProps) {
  const { c } = useTheme();

  const variantKey = size === 'xl' ? 'displayXL' : size === 'l' ? 'displayL' : 'displayM';
  const [fontSize, lineHeight, letterSpacingEm] = type[variantKey];

  const baseStyle: TextStyle = {
    fontFamily: font.display,
    fontSize,
    lineHeight,
    letterSpacing: fontSize * letterSpacingEm,
    color: c.fg,
  };

  const accentStyle: TextStyle = {
    fontFamily: font.accent,
    fontSize: fontSize * 1.04,
    color: c.primary,
    letterSpacing: fontSize * -0.01,
  };

  // Parse *accent* markers
  const parts = text.split(/(\*[^*]+\*)/g);

  return (
    <RNText maxFontSizeMultiplier={1.3} style={[baseStyle, style]}>
      {parts.map((part, idx) => {
        if (part.startsWith('*') && part.endsWith('*')) {
          const inner = part.slice(1, -1).toLowerCase();
          return (
            <RNText key={idx} style={accentStyle}>
              {inner}
            </RNText>
          );
        }
        return (
          <RNText key={idx} style={baseStyle}>
            {part.toLowerCase()}
          </RNText>
        );
      })}
    </RNText>
  );
}
