import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createCampusClient } from '@campuscycle/shared';

// SecureStore refuses values over 2048 bytes and a session is larger, so it is split into key.0..n (03 §3.1).
const CHUNK = 1800;

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    let value = '';
    for (let i = 0; ; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) break;
      value += part;
    }
    return value === '' ? null : value;
  },
  async setItem(key: string, value: string): Promise<void> {
    const parts = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < parts; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await removeFrom(key, parts);
  },
  async removeItem(key: string): Promise<void> {
    await removeFrom(key, 0);
  },
};

async function removeFrom(key: string, start: number): Promise<void> {
  for (let i = start; ; i++) {
    const name = `${key}.${i}`;
    if ((await SecureStore.getItemAsync(name)) === null) break;
    await SecureStore.deleteItemAsync(name);
  }
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// On the web the client falls back to localStorage.
export const db = createCampusClient(url, anonKey, Platform.OS === 'web' ? undefined : secureStorage);

export const functionsUrl = `${url}/functions/v1`;
export const adminUrl = process.env.EXPO_PUBLIC_ADMIN_URL ?? '';
