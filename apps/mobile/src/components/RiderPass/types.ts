import {
  en,
  formatTimer,
  palette,
  relativeTime,
  t,
  timeLeft,
  type Finish,
  type PassStats,
} from '@campuscycle/shared';
import type { PassState } from '@/features/pass/passState';

export type { PassState };

export interface RiderPassProps {
  state: PassState;
  finish: Finish;
  /** Full name; the first word is shown large, the rest as the accent line. */
  name: string;
  collegeShort: string;
  /** `IITK · 0421`, or null while pending. */
  passLabel: string | null;
  rides: number;
  bikeCode?: string;
  fromStand?: string;
  startedAt?: string;
  dueAt?: string;
  returnedStamp?: { stand: string; minutes: number };
  appliedAt?: string;
  suspendedReason?: string | null;
  /** Back face. */
  qr?: { payload: string; expiresAt: string } | null;
  stats?: PassStats;
  /** Tilt and flip (true on Home). */
  interactive?: boolean;
  onFlip?(flipped: boolean): void;
  /** Idle sway without tilt, for the pass on Pending. */
  sway?: boolean;
  /** Play the dock animation once on mount (after a borrow). */
  dock?: boolean;
  /** Called when the mint animation has finished. */
  onMinted?(): void;
  /** Cross-fade to this finish after the stamp (level-up on return). */
  levelUpTo?: Finish;
  /** Card width in px. Defaults to the screen width minus 32, at most 440. */
  width?: number;
  testID?: string;
}

export const PASS_ASPECT = 1.586;

export interface PassColors {
  fg: string;
  muted: string;
  line: string;
  accent: string;
  onAccent: string;
}

export function passColors(finish: Finish): PassColors {
  const p = palette.pass;
  return finish === 'chrome'
    ? {
        fg: p.chromeFg,
        muted: p.chromeMuted,
        line: p.chromeLine,
        accent: p.chromeAccent,
        onAccent: p.chromeOnAccent,
      }
    : { fg: p.fg, muted: p.muted, line: p.line, accent: p.accent, onAccent: p.onAccent };
}

export function splitName(name: string): { first: string; rest: string } {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  return { first: first.toLowerCase(), rest: rest.join(' ').toLowerCase() };
}

/** Everything on the pass that is text, so the native and web cards say the same thing. */
export function passText(p: RiderPassProps, now: number) {
  const left = p.dueAt ? timeLeft(p.dueAt, new Date(now)) : null;
  const overdue = p.state === 'overdue';
  const riding = p.state === 'riding' || overdue;

  let status: string = en.pass.ready;
  if (p.state === 'pending') status = en.pass.pending;
  else if (p.state === 'suspended') status = en.pass.suspended;
  else if (p.state === 'riding') status = t('pass.riding', { left: left ? formatTimer(left.ms) : '' });
  else if (overdue) status = t('pass.overdue', { over: left ? formatTimer(left.ms) : '' });

  const elapsed = p.startedAt ? formatTimer(now - new Date(p.startedAt).getTime()) : '';
  const timer = overdue && left ? `+${formatTimer(left.ms)}` : elapsed;

  const a11yState =
    p.state === 'pending'
      ? en.pass.a11y_pending
      : p.state === 'suspended'
        ? en.pass.a11y_suspended
        : p.state === 'returned'
          ? en.pass.a11y_returned
          : riding
            ? t(overdue ? 'pass.a11y_overdue' : 'pass.a11y_riding', { bike: p.bikeCode ?? '' })
            : en.pass.a11y_ready;

  return {
    status,
    riding,
    timer,
    bottomLeft:
      p.state === 'pending'
        ? t('pass.applied', {
            time: p.appliedAt ? relativeTime(p.appliedAt, new Date(now)) : '',
          }).toUpperCase()
        : riding
          ? t('pass.from', { stand: p.fromStand ?? '' }).toUpperCase()
          : (p.passLabel ?? ''),
    ridesLabel: t('pass.rides', { n: p.rides }),
    stamp: p.returnedStamp
      ? t('pass.returned', { stand: p.returnedStamp.stand.toUpperCase(), n: p.returnedStamp.minutes })
      : '',
    a11y: t('pass.a11y', { passLabel: p.passLabel ?? '', state: a11yState }),
  };
}

/** Seconds left of the pass QR's 30 s window. */
export function qrSecondsLeft(expiresAt: string | undefined, now: number): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.min(30, Math.ceil((new Date(expiresAt).getTime() - now) / 1000)));
}
