import type { ExpoConfig } from 'expo/config';
import fs from 'node:fs';
import path from 'node:path';

const config = {
  name: 'CampusCycle',
  slug: 'campuscycle',
  scheme: 'campuscycle',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: { image: './assets/images/splash.png', resizeMode: 'contain', backgroundColor: '#0B0E13' },
  ios: {
    bundleIdentifier: 'com.sakshamm21.campuscycle',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'CampusCycle scans bike QR codes and takes a photo when you return a bike.',
      NSLocationWhenInUseUsageDescription:
        'CampusCycle checks that you are at a stand when you borrow or return a bike.',
      NSMicrophoneUsageDescription: 'Hold the mic to talk to TORQ. Speech is turned into text on your phone.',
      NSSpeechRecognitionUsageDescription:
        'Hold the mic to talk to TORQ. Speech is turned into text on your phone.',
    },
  },
  android: {
    package: 'com.sakshamm21.campuscycle',
    versionCode: 1,
    adaptiveIcon: { foregroundImage: './assets/images/adaptive-icon.png', backgroundColor: '#0B0E13' },
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : fs.existsSync(path.resolve('./google-services.json'))
        ? { googleServicesFile: './google-services.json' }
        : {}),
    permissions: [
      'CAMERA',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'RECORD_AUDIO',
      'VIBRATE',
      'POST_NOTIFICATIONS',
    ],
    blockedPermissions: ['ACCESS_BACKGROUND_LOCATION'],
    intentFilters: [
      { action: 'VIEW', data: [{ scheme: 'campuscycle' }], category: ['BROWSABLE', 'DEFAULT'] },
    ],
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/images/icon.png' },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-camera',
      {
        cameraPermission: 'CampusCycle scans bike QR codes and takes a photo when you return a bike.',
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'CampusCycle checks that you are at a stand when you borrow or return a bike.',
      },
    ],
    ['expo-notifications', { icon: './assets/images/notification-icon.png', color: '#FFD23F' }],
    [
      'expo-speech-recognition',
      {
        microphonePermission: 'Hold the mic to talk to TORQ.',
        speechRecognitionPermission: 'Hold the mic to talk to TORQ.',
      },
    ],
    '@maplibre/maplibre-react-native',
    'expo-secure-store',
  ],
  experiments: { typedRoutes: true },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
  updates: { url: process.env.EAS_UPDATE_URL },
  runtimeVersion: { policy: 'appVersion' },
};

export default config as unknown as ExpoConfig;
