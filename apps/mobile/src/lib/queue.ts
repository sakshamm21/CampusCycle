import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cc-photo-queue';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface QueuedPhoto {
  rideId: string;
  uri: string;
  createdAt: string;
}

export interface QueueDeps {
  /** Uploads the local file and returns its storage path. */
  upload(uri: string): Promise<string>;
  attach(rideId: string, path: string): Promise<void>;
  now?(): number;
}

async function read(): Promise<QueuedPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const items: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? (items as QueuedPhoto[]) : [];
  } catch {
    return [];
  }
}

export async function queuedPhotos(): Promise<QueuedPhoto[]> {
  return read();
}

/** Keeps a return photo whose upload failed, to be sent later (04 §1.7). */
export async function enqueuePhoto(rideId: string, uri: string, now = Date.now()): Promise<void> {
  const items = await read();
  items.push({ rideId, uri, createdAt: new Date(now).toISOString() });
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

let flushing = false;

// Runs on app start, when the app comes to the foreground and when the network returns.
export async function flushQueue(deps: QueueDeps): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const now = deps.now?.() ?? Date.now();
    const keep: QueuedPhoto[] = [];
    for (const item of await read()) {
      if (now - new Date(item.createdAt).getTime() > MAX_AGE_MS) continue;
      try {
        const path = await deps.upload(item.uri);
        await deps.attach(item.rideId, path);
      } catch {
        keep.push(item);
      }
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(keep));
  } finally {
    flushing = false;
  }
}
