import React, { useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flashlight, X } from 'lucide-react-native';
import { AppError, en, listPickableBikes, messageFor, normalizeCode, parseQr, t } from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { createScanGuard } from '@/lib/camera';
import { useSession } from '@/lib/session';
import { useCameraStatus } from '@/components/CameraBox';
import { Field } from '@/components/Field';
import { IconButton } from '@/components/IconButton';
import { Kicker } from '@/components/Kicker';
import { Pill } from '@/components/Pill';
import { Sheet } from '@/components/Sheet';
import { ErrorState } from '@/components/States';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { useReturnFlow } from '@/features/ride/ReturnFlowProvider';
import { useTheme } from '@/theme/ThemeProvider';

const FRAME = 260;
const OVERLAY = 'rgba(5,7,10,0.72)';

function Frame() {
  const { c } = useTheme();
  const tick = (place: object) => (
    <View style={[{ position: 'absolute', width: 34, height: 34, borderColor: c.primary }, place]} />
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ flex: 1, backgroundColor: OVERLAY }} />
      <View style={{ flexDirection: 'row', height: FRAME }}>
        <View style={{ flex: 1, backgroundColor: OVERLAY }} />
        <View style={{ width: FRAME, height: FRAME }}>
          {tick({ left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 28 })}
          {tick({ right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 28 })}
          {tick({ left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 28 })}
          {tick({
            right: 0,
            bottom: 0,
            borderRightWidth: 4,
            borderBottomWidth: 4,
            borderBottomRightRadius: 28,
          })}
        </View>
        <View style={{ flex: 1, backgroundColor: OVERLAY }} />
      </View>
      <View style={{ flex: 1, backgroundColor: OVERLAY }} />
    </View>
  );
}

// R11 Scanner (`?mode=borrow|return`)
export default function Scan() {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const mode = modeParam === 'return' ? 'return' : 'borrow';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { c } = useTheme();
  const { ctx } = useSession();
  const { setScan } = useReturnFlow();
  const status = useCameraStatus();
  const guard = useRef(createScanGuard()).current;

  const [torch, setTorch] = useState(false);
  const [entering, setEntering] = useState(false);
  const [picking, setPicking] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const demo = !!ctx?.profile.is_demo;
  const rideBike = ctx?.ride?.bike_code ?? '';
  const pickable = useQuery({
    queryKey: ['pickable'],
    queryFn: () => listPickableBikes(db),
    enabled: demo && mode === 'borrow' && picking,
  });
  const bikes = pickable.data;
  const byStand = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof bikes>>();
    for (const bike of bikes ?? []) {
      groups.set(bike.stand_name, [...(groups.get(bike.stand_name) ?? []), bike]);
    }
    return [...groups.entries()];
  }, [bikes]);

  const accept = (bike: { code: string; sig: string }) => {
    if (mode === 'borrow') {
      router.replace({ pathname: '/borrow', params: bike });
    } else {
      setScan(bike);
      router.back();
    }
  };

  const onScan = (raw: string) => {
    if (!guard()) return;
    const parsed = parseQr(raw);
    if (parsed.kind === 'bike') accept({ code: parsed.code, sig: parsed.sig });
    else if (parsed.kind === 'pass') toast.show(en.r11.is_pass, 'warn');
    else toast.show(en.r11.unknown, 'warn');
  };

  const submitCode = () => {
    const normalized = normalizeCode(code);
    if (!normalized) {
      setCodeError(messageFor('CC_BAD_CODE'));
      return;
    }
    setEntering(false);
    // A typed code has no signature: the server records it as manual.
    accept({ code: normalized, sig: '' });
  };

  const buttons = (
    <>
      <Pill
        testID="r11.enter_code"
        variant="secondary"
        block
        label={en.r11.enter_code}
        onPress={() => setEntering(true)}
      />
      {demo && mode === 'borrow' ? (
        <Pill testID="r11.demo_pick" block label={en.r11.demo_pick} onPress={() => setPicking(true)} />
      ) : null}
      {demo && mode === 'return' && rideBike ? (
        <Pill
          testID="r11.demo_use"
          block
          label={t('r11.demo_use', { bike: rideBike })}
          onPress={() => accept({ code: rideBike, sig: '' })}
        />
      ) : null}
    </>
  );

  return (
    <View testID="r11" style={{ flex: 1, backgroundColor: status === 'ready' ? '#000000' : c.bg }}>
      {status === 'ready' ? (
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => onScan(data)}
          />
          <Frame />
        </>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
        }}
      >
        <IconButton
          testID="r11.close"
          icon={X}
          label={en.r11.close}
          onDark={status === 'ready'}
          onPress={() => router.back()}
        />
        {status === 'ready' && Platform.OS !== 'web' ? (
          <IconButton
            testID="r11.torch"
            icon={Flashlight}
            label={en.r11.torch}
            onDark
            active={torch}
            onPress={() => setTorch((on) => !on)}
          />
        ) : null}
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 16 }}>
        {status === 'ready' ? (
          <View style={{ alignItems: 'center', marginBottom: FRAME + 48 }}>
            <Text
              variant="label"
              style={{ color: '#F1F3F7', textAlign: 'center' }}
              testID={mode === 'borrow' ? 'r11.kicker_borrow' : 'r11.kicker_return'}
            >
              {mode === 'borrow' ? en.r11.kicker_borrow : t('r11.kicker_return', { bike: rideBike })}
            </Text>
          </View>
        ) : status === 'checking' ? null : (
          <>
            <Kicker
              text={mode === 'borrow' ? en.r11.kicker_borrow : t('r11.kicker_return', { bike: rideBike })}
            />
            <ErrorState
              error={new AppError('CC_CAMERA_DENIED')}
              primary={
                status === 'denied' && Platform.OS !== 'web'
                  ? { label: en.common.open_settings, onPress: () => void Linking.openSettings() }
                  : undefined
              }
            />
          </>
        )}
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 8 }}>{buttons}</View>

      <Sheet open={entering} onClose={() => setEntering(false)} testID="r11.code_sheet">
        <Field
          testID="r11.code"
          label={en.r11.code_label}
          hint={en.r11.code_hint}
          placeholder={en.r11.code_placeholder}
          value={code}
          onChangeText={(v) => {
            setCode(v.toUpperCase());
            setCodeError(null);
          }}
          error={codeError}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={submitCode}
        />
        <Pill testID="r11.go" size="lg" label={en.r11.go} onPress={submitCode} />
      </Sheet>

      <Sheet open={picking} onClose={() => setPicking(false)} testID="r11.pick_sheet">
        {pickable.error ? (
          <ErrorState error={pickable.error} onRetry={() => void pickable.refetch()} />
        ) : null}
        {byStand.map(([stand, standBikes]) => (
          <View key={stand} style={{ gap: 6 }}>
            <Kicker text={stand} />
            {standBikes.map((bike, i) => (
              <Pressable
                key={bike.bike_id}
                testID={i === 0 && stand === byStand[0]?.[0] ? 'r11.pick.0' : `r11.pick.${bike.code}`}
                accessibilityRole="button"
                onPress={() => {
                  setPicking(false);
                  // Exactly like scanning that bike's sticker.
                  const parsed = parseQr(bike.payload);
                  if (parsed.kind === 'bike') accept({ code: parsed.code, sig: parsed.sig });
                }}
                style={{
                  minHeight: 48,
                  justifyContent: 'center',
                  borderBottomWidth: 1,
                  borderBottomColor: c.border,
                }}
              >
                <Text variant="body">{t('r11.demo_row', { code: bike.code, stand })}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </Sheet>
    </View>
  );
}
