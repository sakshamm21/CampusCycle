import React from 'react';
import { Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { Bike } from 'lucide-react-native';
import { en, font, palette } from '@campuscycle/shared';
import { passText, splitName, type PassColors, type RiderPassProps } from './types';

interface Props {
  pass: RiderPassProps;
  /** One card unit in px (card width / 100). */
  u: number;
  colors: PassColors;
  now: number;
  chipStyle: AnimatedStyle<ViewStyle>;
  stampStyle: AnimatedStyle<ViewStyle>;
}

// The front of the card (06 §6.2): plain views over the Skia background, so screen readers can read them.
export function PassFront({ pass, u, colors, now, chipStyle, stampStyle }: Props) {
  const text = passText(pass, now);
  const name = splitName(pass.name);
  const { state } = pass;
  const overdue = state === 'overdue';
  // Pending is greyscale: the accent goes grey too.
  const accent = state === 'pending' ? colors.muted : colors.accent;
  const chip = overdue
    ? { bg: palette.pass.overdue, fg: palette.pass.onOverdue }
    : { bg: colors.accent, fg: colors.onAccent };

  const mono = (size: number, extra?: TextStyle): TextStyle => ({
    fontFamily: font.monoMedium,
    fontSize: size * u,
    lineHeight: size * u * 1.2,
    letterSpacing: size * u * 0.12,
    color: colors.muted,
    ...extra,
  });

  const dot =
    state === 'pending'
      ? colors.muted
      : state === 'suspended'
        ? palette.pass.suspended
        : text.riding
          ? chip.fg
          : palette.dark.ok;

  const contentFilter =
    state === 'suspended'
      ? { opacity: 0.55, filter: [{ blur: 1.2 * u }] }
      : state === 'pending'
        ? { opacity: 0.42, filter: [{ grayscale: 1 }] }
        : null;

  return (
    <>
      <View
        style={[
          { flex: 1, paddingVertical: 6 * u, paddingHorizontal: 6.5 * u, gap: 2.4 * u },
          contentFilter as ViewStyle | null,
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 * u }}>
            <View
              style={{
                width: 6.2 * u,
                height: 6.2 * u,
                borderRadius: 3.1 * u,
                backgroundColor: accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bike size={4.4 * u} color={colors.onAccent} strokeWidth={2.2} />
            </View>
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: font.display,
                fontSize: 4.2 * u,
                letterSpacing: 4.2 * u * -0.04,
                color: colors.fg,
              }}
            >
              {en.common.wordmark}
            </Text>
          </View>
          <Text allowFontScaling={false} style={mono(2.5, { letterSpacing: 2.5 * u * 0.16 })}>
            {en.pass.kicker}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 * u, marginTop: 1.5 * u }}>
          <View
            style={{
              minWidth: 15 * u,
              height: 11 * u,
              borderRadius: 2.6 * u,
              borderWidth: 0.45 * u,
              borderStyle: 'dashed',
              borderColor: colors.line,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {text.riding ? (
              <Animated.View
                style={[
                  {
                    minWidth: 15 * u,
                    height: 11 * u,
                    marginVertical: -0.45 * u,
                    paddingHorizontal: 2.6 * u,
                    borderRadius: 2.6 * u,
                    backgroundColor: chip.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  },
                  chipStyle,
                ]}
              >
                {/* Two vertical lines, like the contacts of a card chip. */}
                <View
                  style={{
                    position: 'absolute',
                    left: '31%',
                    top: 0,
                    bottom: 0,
                    width: '2%',
                    backgroundColor: chip.fg,
                    opacity: 0.22,
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: '67%',
                    top: 0,
                    bottom: 0,
                    width: '2%',
                    backgroundColor: chip.fg,
                    opacity: 0.22,
                  }}
                />
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{
                    fontFamily: font.monoBold,
                    fontSize: 3.6 * u,
                    letterSpacing: 3.6 * u * 0.02,
                    color: chip.fg,
                  }}
                >
                  {pass.bikeCode ?? ''}
                </Text>
              </Animated.View>
            ) : (
              <Text allowFontScaling={false} style={mono(2.1, { letterSpacing: 2.1 * u * 0.14 })}>
                {en.pass.dock}
              </Text>
            )}
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 1.6 * u,
              borderRadius: 999,
              paddingVertical: 1.6 * u,
              paddingHorizontal: 2.6 * u,
              backgroundColor: text.riding
                ? chip.bg
                : state === 'pending'
                  ? 'rgba(127,127,127,0.18)'
                  : 'rgba(127,127,127,0.16)',
            }}
          >
            <View style={{ width: 1.7 * u, height: 1.7 * u, borderRadius: u, backgroundColor: dot }} />
            <Text
              allowFontScaling={false}
              style={mono(2.5, {
                letterSpacing: 2.5 * u * 0.1,
                color: text.riding ? chip.fg : colors.fg,
                fontVariant: ['tabular-nums'],
              })}
            >
              {text.status}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              fontFamily: font.display,
              fontSize: 8.6 * u,
              lineHeight: 8.6 * u * 1.0,
              letterSpacing: 8.6 * u * -0.055,
              color: colors.fg,
            }}
          >
            {name.first}
          </Text>
          {name.rest ? (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={{
                fontFamily: font.accent,
                fontSize: 6 * u,
                lineHeight: 6 * u * 1.15,
                letterSpacing: 6 * u * -0.01,
                color: accent,
              }}
            >
              {name.rest}
            </Text>
          ) : null}
        </View>

        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 2 * u }}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={mono(2.6, { fontFamily: font.monoBold, color: colors.fg, flexShrink: 1 })}
          >
            {text.bottomLeft}
          </Text>
          <Text allowFontScaling={false} style={mono(2.6, { fontVariant: ['tabular-nums'] })}>
            {text.riding ? text.timer : text.ridesLabel}
          </Text>
          <Text allowFontScaling={false} style={mono(2.6)}>
            {pass.collegeShort}
          </Text>
        </View>
      </View>

      {state === 'pending' ? (
        <View
          style={{
            position: 'absolute',
            right: 6 * u,
            top: 31 * u,
            borderWidth: 0.6 * u,
            borderStyle: 'dashed',
            borderColor: colors.fg,
            borderRadius: 2.6 * u,
            paddingVertical: 2.4 * u,
            paddingHorizontal: 3.2 * u,
            transform: [{ rotate: '-9deg' }],
          }}
        >
          <Text
            allowFontScaling={false}
            style={mono(3.1, { fontFamily: font.monoBold, color: colors.fg, textAlign: 'center' })}
          >
            {en.pass.awaiting}
          </Text>
        </View>
      ) : null}

      {state === 'returned' && text.stamp ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              right: 6 * u,
              top: 18 * u,
              maxWidth: 62 * u,
              backgroundColor: palette.pass.stamp,
              borderRadius: 2.6 * u,
              paddingVertical: 2.4 * u,
              paddingHorizontal: 3.2 * u,
              boxShadow: `0px ${2 * u}px ${6 * u}px ${-2 * u}px rgba(0,0,0,0.5)`,
            },
            stampStyle,
          ]}
        >
          <Text
            allowFontScaling={false}
            style={mono(3.1, { fontFamily: font.monoBold, color: palette.pass.onStamp, textAlign: 'center' })}
          >
            {text.stamp}
          </Text>
        </Animated.View>
      ) : null}

      {state === 'suspended' ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          <View
            style={{
              backgroundColor: palette.pass.suspended,
              borderRadius: 2.6 * u,
              paddingVertical: 2.4 * u,
              paddingHorizontal: 3.2 * u,
            }}
          >
            <Text allowFontScaling={false} style={mono(3.1, { fontFamily: font.monoBold, color: '#FFFFFF' })}>
              {en.pass.suspended}
            </Text>
          </View>
        </View>
      ) : null}
    </>
  );
}
