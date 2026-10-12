import * as Location from 'expo-location';
import { AppError, LOCATION_TIMEOUT_MS, type GeoFix, type MyContext } from '@campuscycle/shared';

const FIX_MAX_AGE_MS = 60_000;
const DEMO_FIX: GeoFix = { lat: null, lng: null, accuracy: null, isMock: false };

let cached: { fix: GeoFix; at: number } | null = null;

/** The last fix if it is younger than 60 s. Never prompts. */
export function cachedFix(): GeoFix | null {
  return cached && Date.now() - cached.at < FIX_MAX_AGE_MS ? cached.fix : null;
}

export function clearFix(): void {
  cached = null;
}

export async function hasLocationPermission(): Promise<boolean> {
  const { granted } = await Location.getForegroundPermissionsAsync();
  return granted;
}

// Location is read only when borrowing, returning or listing nearby stands (04 §1.4).
export async function getFix(ctx: MyContext): Promise<GeoFix> {
  if (ctx.profile.is_demo) return DEMO_FIX;

  const fresh = cachedFix();
  if (fresh) return fresh;

  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) throw new AppError('CC_LOCATION_DENIED');

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AppError('CC_LOCATION_TIMEOUT')), LOCATION_TIMEOUT_MS);
  });
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
      timeout,
    ]);
    const fix: GeoFix = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      isMock: position.mocked === true,
    };
    cached = { fix, at: Date.now() };
    return fix;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('CC_LOCATION_TIMEOUT');
  } finally {
    clearTimeout(timer);
  }
}

/** A fix for listing stands: only when permission is already granted, and never an error. */
export async function getFixIfAllowed(ctx: MyContext): Promise<GeoFix | null> {
  if (ctx.profile.is_demo) return null;
  try {
    if (!(await hasLocationPermission())) return null;
    return await getFix(ctx);
  } catch {
    return null;
  }
}

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
