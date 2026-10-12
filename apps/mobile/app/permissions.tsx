import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import * as Location from 'expo-location';
import { Camera as ExpoCamera } from 'expo-camera';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Bell, Camera, MapPin, Mic, type LucideIcon } from 'lucide-react-native';
import { en } from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import {
  getPushPermission,
  registerPush,
  requestPushPermission,
  toPermissionState,
  type PermissionState,
} from '@/lib/push';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Headline } from '@/components/Headline';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

type Key = 'location' | 'camera' | 'notifications' | 'microphone';

const ROWS: { key: Key; icon: LucideIcon; title: string; reason: string; web: boolean }[] = [
  { key: 'location', icon: MapPin, title: en.r05.loc_t, reason: en.r05.loc_d, web: true },
  { key: 'camera', icon: Camera, title: en.r05.cam_t, reason: en.r05.cam_d, web: true },
  { key: 'notifications', icon: Bell, title: en.r05.not_t, reason: en.r05.not_d, web: false },
  { key: 'microphone', icon: Mic, title: en.r05.mic_t, reason: en.r05.mic_d, web: true },
];

const check: Record<Key, () => Promise<PermissionState>> = {
  location: async () => toPermissionState(await Location.getForegroundPermissionsAsync()),
  camera: async () => toPermissionState(await ExpoCamera.getCameraPermissionsAsync()),
  notifications: getPushPermission,
  microphone: async () => toPermissionState(await ExpoSpeechRecognitionModule.getPermissionsAsync()),
};

const request: Record<Key, () => Promise<PermissionState>> = {
  location: async () => toPermissionState(await Location.requestForegroundPermissionsAsync()),
  camera: async () => toPermissionState(await ExpoCamera.requestCameraPermissionsAsync()),
  notifications: requestPushPermission,
  microphone: async () => toPermissionState(await ExpoSpeechRecognitionModule.requestPermissionsAsync()),
};

// R05 Permissions: shown once per install, nothing is required
export default function Permissions() {
  const { c } = useTheme();
  const { markPermsSeen } = useSession();
  const [state, setState] = useState<Partial<Record<Key, PermissionState>>>({});
  const rows = ROWS.filter((r) => r.web || Platform.OS !== 'web');

  useEffect(() => {
    for (const row of rows) {
      check[row.key]()
        .then((s) => setState((prev) => ({ ...prev, [row.key]: s })))
        .catch(() => setState((prev) => ({ ...prev, [row.key]: 'ask' })));
    }
    // Read once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each Allow asks for that one permission only.
  const allow = async (key: Key) => {
    try {
      const next = await request[key]();
      setState((prev) => ({ ...prev, [key]: next === 'ask' ? 'denied' : next }));
    } catch {
      setState((prev) => ({ ...prev, [key]: 'denied' }));
    }
  };

  const finish = async () => {
    await markPermsSeen();
    if (state.notifications === 'granted') void registerPush(db);
  };

  return (
    <Screen
      header={{ hideBack: true }}
      testID="r05"
      footer={<Pill testID="r05.continue" size="lg" label={en.r05.continue} onPress={() => void finish()} />}
    >
      <Headline text={en.r05.title} size="l" />
      <Text variant="body" tone="muted">
        {en.r05.body}
      </Text>
      {rows.map(({ key, icon: Icon, title, reason }) => (
        <Card key={key} testID={`r05.${key}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon size={20} color={c.fg} strokeWidth={2} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="displayS">{title.toLowerCase()}</Text>
              <Text variant="bodyS" tone="muted">
                {reason}
              </Text>
            </View>
            {state[key] === 'granted' ? (
              <Chip text={en.r05.granted} tone="ok" />
            ) : state[key] === 'denied' ? (
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Chip text={en.r05.denied} tone="warn" />
                {Platform.OS !== 'web' ? (
                  <Pressable
                    accessibilityRole="link"
                    hitSlop={12}
                    onPress={() => void Linking.openSettings()}
                  >
                    <Text variant="bodyS" tone="primary">
                      {en.r05.settings}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Pill
                testID={`r05.allow.${key}`}
                size="sm"
                label={en.r05.allow}
                onPress={() => void allow(key)}
              />
            )}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
