import { formatInTimeZone } from 'date-fns-tz';
import { format, isYesterday } from 'date-fns';
import { FINISH_THRESHOLDS } from './constants.ts';

export function formatDistance(m: number | null): string {
  if (m === null || m === undefined || isNaN(m)) return '';
  if (m < 1000) {
    return `${Math.round(m)} m`;
  }
  return `${(m / 1000).toFixed(1)} km`;
}

export function walkMinutes(m: number): number {
  return Math.max(1, Math.round(m / 80));
}

export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) {
    return `${m} min`;
  }
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  return `${hours} h ${String(mins).padStart(2, '0')} min`;
}

export function formatClock(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, 'h:mm a');
}

export function formatTimer(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function timeLeft(dueIso: string, now: Date | string = new Date()): { ms: number; overdue: boolean } {
  const nowDate = typeof now === 'string' ? new Date(now) : now;
  const dueDate = new Date(dueIso);
  const diff = dueDate.getTime() - nowDate.getTime();
  return {
    ms: Math.abs(diff),
    overdue: diff < 0,
  };
}

export function passLabel(shortCode: string, number: number): string {
  return `${shortCode} · ${String(number).padStart(4, '0')}`;
}

export function finishFor(rides: number): 'graphite' | 'chrome' | 'holo' {
  if (rides >= FINISH_THRESHOLDS.holo) return 'holo';
  if (rides >= FINISH_THRESHOLDS.chrome) return 'chrome';
  return 'graphite';
}

export function relativeTime(iso: string, now: Date | string = new Date()): string {
  const nowDate = typeof now === 'string' ? new Date(now) : now;
  const date = new Date(iso);
  const diffMs = nowDate.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) {
    return 'just now';
  }
  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }
  if (diffHour < 24 && nowDate.getDate() === date.getDate()) {
    return `${diffHour} h ago`;
  }
  if (isYesterday(date)) {
    return 'yesterday';
  }
  return format(date, 'd MMM');
}

export function formatDateTime(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, 'd MMM, h:mm a');
}

export const formatRelative = relativeTime;

/** `12 Oct` in the college time zone. */
export function formatDay(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, 'd MMM');
}

/** `Oct 2026` in the college time zone: the month headers of ride history. */
export function formatMonth(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, 'MMM yyyy');
}

/** A finished ride's length: `mm:ss` under an hour, `h:mm` above. */
export function formatRideClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 3600) return formatTimer(ms);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

/** Rides still needed for the next finish, by the same thresholds as SQL. */
export function nextFinish(rides: number): { next: 'chrome' | 'holo' | null; ridesToNext: number } {
  if (rides < FINISH_THRESHOLDS.chrome)
    return { next: 'chrome', ridesToNext: FINISH_THRESHOLDS.chrome - rides };
  if (rides < FINISH_THRESHOLDS.holo) return { next: 'holo', ridesToNext: FINISH_THRESHOLDS.holo - rides };
  return { next: null, ridesToNext: 0 };
}
