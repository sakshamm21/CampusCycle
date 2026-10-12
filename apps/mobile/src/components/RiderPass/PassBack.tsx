import React from 'react';
import { ActivityIndicator, Text, View, type TextStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { en, font, palette } from '@campuscycle/shared';
import { qrSecondsLeft, type PassColors, type RiderPassProps } from './types';

interface Props {
  pass: RiderPassProps;
  u: number;
  colors: PassColors;
  now: number;
}

// The back of the card (06 §6.4): the live pass QR, a countdown ring and four stats.
export function PassBack({ pass, u, colors, now }: Props) {
  const { stats, qr, state } = pass;
  const noQr = state === 'pending' || state === 'suspended';
  const left = qrSecondsLeft(qr?.expiresAt, now);
  const qrSize = 38 * u - 4 * u;

  const mono = (size: number, extra?: TextStyle): TextStyle => ({
    fontFamily: font.monoMedium,
    fontSize: size * u,
    lineHeight: size * u * 1.2,
    letterSpacing: size * u * 0.12,
    color: colors.muted,
    ...extra,
  });

  const stat = (value: string, label: string) => (
    <View key={label} style={{ flex: 1, gap: u }}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          fontFamily: font.numeric,
          fontSize: 5.4 * u,
          lineHeight: 5.6 * u,
          color: colors.fg,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text allowFontScaling={false} style={mono(2.1)}>
        {label}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, paddingVertical: 5.5 * u, paddingHorizontal: 6.5 * u, gap: 2.6 * u }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text allowFontScaling={false} style={mono(2.5, { letterSpacing: 2.5 * u * 0.16 })}>
          {en.pass.show_admin}
        </Text>
        {noQr ? null : (
          <Svg width={9 * u} height={9 * u} viewBox="0 0 32 32" style={{ transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={16} cy={16} r={14} fill="none" strokeWidth={3.2} stroke={colors.line} />
            <Circle
              cx={16}
              cy={16}
              r={14}
              fill="none"
              strokeWidth={3.2}
              stroke={colors.accent}
              strokeLinecap="round"
              strokeDasharray={88}
              strokeDashoffset={88 * (1 - left / 30)}
            />
          </Svg>
        )}
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: 5 * u }}>
        <View
          style={{
            width: 38 * u,
            height: 38 * u,
            maxHeight: '100%',
            aspectRatio: 1,
            borderRadius: 3 * u,
            padding: 2 * u,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {noQr ? null : qr ? (
            <QRCode
              value={qr.payload}
              size={qrSize}
              ecl="M"
              color={palette.sticker.ink}
              backgroundColor="#FFFFFF"
            />
          ) : (
            <ActivityIndicator color={palette.sticker.ink} />
          )}
        </View>
        <Text
          allowFontScaling={false}
          style={{
            flex: 1,
            fontFamily: font.bodyMedium,
            fontSize: 3.1 * u,
            lineHeight: 3.1 * u * 1.35,
            color: colors.fg,
          }}
        >
          {noQr ? en.pass.no_qr : en.pass.back_note}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: 2 * u,
          borderTopWidth: 0.3 * u,
          borderTopColor: colors.line,
          paddingTop: 2.6 * u,
        }}
      >
        {stat(String(stats?.rides ?? pass.rides), en.pass.stat_rides)}
        {stat(String(stats?.minutes ?? 0), en.pass.stat_minutes)}
        {stat(stats?.fave_stand ?? en.pass.none, en.pass.stat_fave)}
        {stat(String(stats?.strikes ?? 0), en.pass.stat_strikes)}
      </View>
    </View>
  );
}
