import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueuePhoto, flushQueue, queuedPhotos } from './queue';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => void store.set(k, v)),
      removeItem: jest.fn(async (k: string) => void store.delete(k)),
      clear: jest.fn(async () => store.clear()),
    },
  };
});

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse('2026-10-12T10:00:00Z');

describe('photo upload queue (04 §1.7)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('keeps a failed upload under cc-photo-queue', async () => {
    await enqueuePhoto('ride-1', 'file:///a.jpg', T0);
    expect(await queuedPhotos()).toEqual([
      { rideId: 'ride-1', uri: 'file:///a.jpg', createdAt: new Date(T0).toISOString() },
    ]);
    expect(await AsyncStorage.getItem('cc-photo-queue')).toContain('ride-1');
  });

  it('uploads, attaches to the ride and removes the item on success', async () => {
    await enqueuePhoto('ride-1', 'file:///a.jpg', T0);
    const upload = jest.fn(async () => 'u1/a.jpg');
    const attach = jest.fn(async () => {});

    await flushQueue({ upload, attach, now: () => T0 + HOUR });

    expect(upload).toHaveBeenCalledWith('file:///a.jpg');
    expect(attach).toHaveBeenCalledWith('ride-1', 'u1/a.jpg');
    expect(await queuedPhotos()).toEqual([]);
  });

  it('keeps the item when the upload fails, and when attaching fails', async () => {
    await enqueuePhoto('ride-1', 'file:///a.jpg', T0);
    await enqueuePhoto('ride-2', 'file:///b.jpg', T0);
    const upload = jest.fn(async (uri: string) => {
      if (uri.endsWith('a.jpg')) throw new Error('offline');
      return 'u1/b.jpg';
    });
    const attach = jest.fn(async () => {
      throw new Error('rpc failed');
    });

    await flushQueue({ upload, attach, now: () => T0 + HOUR });

    expect((await queuedPhotos()).map((p) => p.rideId)).toEqual(['ride-1', 'ride-2']);
  });

  it('drops an item older than 24 hours without uploading it', async () => {
    await enqueuePhoto('old', 'file:///old.jpg', T0);
    await enqueuePhoto('new', 'file:///new.jpg', T0 + 2 * HOUR);
    const upload = jest.fn(async () => {
      throw new Error('offline');
    });

    await flushQueue({ upload, attach: jest.fn(), now: () => T0 + 25 * HOUR });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith('file:///new.jpg');
    expect((await queuedPhotos()).map((p) => p.rideId)).toEqual(['new']);
  });

  it('survives a corrupt stored value', async () => {
    await AsyncStorage.setItem('cc-photo-queue', '{not json');
    expect(await queuedPhotos()).toEqual([]);
    await enqueuePhoto('ride-1', 'file:///a.jpg', T0);
    expect(await queuedPhotos()).toHaveLength(1);
  });
});
