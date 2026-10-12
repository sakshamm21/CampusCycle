import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, X } from 'lucide-react-native';
import { AppError, en } from '@campuscycle/shared';
import { cameraAvailable } from '@/lib/camera';
import type { LocalPhoto } from '@/lib/photos';
import { ErrorState } from '@/components/States';
import { IconButton } from '@/components/IconButton';
import { Pill } from '@/components/Pill';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

export type CameraStatus = 'checking' | 'ready' | 'denied' | 'unavailable';

/** Whether a camera can be used right now; asks for the permission once. */
export function useCameraStatus(): CameraStatus {
  const [permission, request] = useCameraPermissions();
  const [available, setAvailable] = useState<boolean | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    cameraAvailable().then(setAvailable);
  }, []);

  useEffect(() => {
    if (available && permission && !permission.granted && permission.canAskAgain && !asked.current) {
      asked.current = true;
      void request();
    }
  }, [available, permission, request]);

  if (available === false) return 'unavailable';
  if (available === null || !permission) return 'checking';
  if (permission.granted) return 'ready';
  return permission.canAskAgain && !asked.current ? 'checking' : 'denied';
}

export interface CameraBoxProps {
  onCapture(photo: LocalPhoto): void;
  status: CameraStatus;
  height?: number;
  shutterLabel: string;
  testID?: string;
}

// An in-screen camera with a round shutter (04 R14 step 3).
export function CameraBox({ onCapture, status, height = 360, shutterLabel, testID }: CameraBoxProps) {
  const { c } = useTheme();
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  const shoot = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.8, skipProcessing: false });
      if (photo) onCapture({ uri: photo.uri, width: photo.width, height: photo.height });
    } catch (e) {
      console.error('[camera] capture failed', e);
    } finally {
      setBusy(false);
    }
  };

  if (status !== 'ready') {
    return (
      <View
        style={{
          height,
          borderRadius: 26,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          padding: 16,
          justifyContent: 'center',
        }}
      >
        {status === 'checking' ? (
          <ActivityIndicator color={c.primary} />
        ) : (
          <ErrorState
            error={new AppError('CC_CAMERA_DENIED')}
            primary={
              status === 'denied' && Platform.OS !== 'web'
                ? { label: en.common.open_settings, onPress: () => void Linking.openSettings() }
                : undefined
            }
          />
        )}
      </View>
    );
  }

  return (
    <View style={{ height, borderRadius: 26, overflow: 'hidden', backgroundColor: '#000000' }}>
      <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 16, alignItems: 'center' }}>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={shutterLabel}
          onPress={() => void shoot()}
          style={({ pressed }) => ({
            width: 72,
            height: 72,
            borderRadius: 36,
            borderWidth: 4,
            borderColor: '#FFFFFF',
            backgroundColor: pressed ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.9)',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          {busy ? <ActivityIndicator color="#0B0E13" /> : null}
        </Pressable>
      </View>
    </View>
  );
}

export interface PhotoTileProps {
  /** Text inside the empty tile. */
  label: string;
  photo: LocalPhoto | null;
  onChange(photo: LocalPhoto | null): void;
  height?: number;
  retakeLabel: string;
  shutterLabel: string;
  /** Shown over the preview, e.g. the "TORQ is looking…" chip. */
  overlay?: React.ReactNode;
  testID?: string;
}

// A dashed tile that opens the camera (or, in a browser without one, the file picker) and then
// shows the photo with Retake (04 R04 step 4, R16).
export function PhotoTile({
  label,
  photo,
  onChange,
  height = 180,
  retakeLabel,
  shutterLabel,
  overlay,
  testID,
}: PhotoTileProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const start = async () => {
    if (Platform.OS === 'web' && !(await cameraAvailable())) {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      const asset = picked.canceled ? null : picked.assets[0];
      if (asset) onChange({ uri: asset.uri, width: asset.width, height: asset.height });
      return;
    }
    setOpen(true);
  };

  return (
    <>
      {photo ? (
        <View style={{ height, borderRadius: 22, overflow: 'hidden', backgroundColor: c.surface }}>
          <Image
            source={{ uri: photo.uri }}
            style={{ flex: 1 }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <View style={{ position: 'absolute', left: 12, top: 12 }}>{overlay}</View>
          <View style={{ position: 'absolute', right: 12, bottom: 12 }}>
            <Pill
              size="sm"
              variant="secondary"
              label={retakeLabel}
              onPress={() => void start()}
              testID={testID ? `${testID}.retake` : undefined}
            />
          </View>
        </View>
      ) : (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => void start()}
          style={{
            minHeight: height,
            borderRadius: 22,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: c.borderStrong,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 20,
          }}
        >
          <Camera size={24} color={c.muted} strokeWidth={2} />
          <Text variant="bodyS" tone="muted" style={{ textAlign: 'center' }}>
            {label}
          </Text>
        </Pressable>
      )}
      {open ? (
        <CameraModal
          shutterLabel={shutterLabel}
          topInset={insets.top}
          onClose={() => setOpen(false)}
          onCapture={(p) => {
            setOpen(false);
            onChange(p);
          }}
        />
      ) : null}
    </>
  );
}

function CameraModal({
  onCapture,
  onClose,
  shutterLabel,
  topInset,
}: {
  onCapture(photo: LocalPhoto): void;
  onClose(): void;
  shutterLabel: string;
  topInset: number;
}) {
  const status = useCameraStatus();
  const { c } = useTheme();
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View
        style={{ flex: 1, backgroundColor: c.bg, paddingTop: topInset + 8, paddingHorizontal: 16, gap: 16 }}
      >
        <IconButton icon={X} label={en.common.close} onPress={onClose} testID="camera.close" />
        <CameraBox
          status={status}
          height={480}
          onCapture={onCapture}
          shutterLabel={shutterLabel}
          testID="camera.shutter"
        />
      </View>
    </Modal>
  );
}
