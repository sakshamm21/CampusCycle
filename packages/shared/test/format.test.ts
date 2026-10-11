import { describe, it, expect } from 'vitest';
import {
  formatDistance,
  walkMinutes,
  formatDuration,
  formatClock,
  formatTimer,
  timeLeft,
  passLabel,
  finishFor,
  relativeTime,
} from '../src/format.ts';

describe('formatDistance', () => {
  it('formats null as empty string', () => {
    expect(formatDistance(null)).toBe('');
  });

  it('formats meters under 1000', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(120)).toBe('120 m');
    expect(formatDistance(999)).toBe('999 m');
  });

  it('formats km from 1000 and above with one decimal', () => {
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(1250)).toBe('1.3 km');
    expect(formatDistance(2000)).toBe('2.0 km');
  });
});

describe('walkMinutes', () => {
  it('calculates walk time at 80 m/min with min 1 min', () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(40)).toBe(1);
    expect(walkMinutes(80)).toBe(1);
    expect(walkMinutes(160)).toBe(2);
    expect(walkMinutes(800)).toBe(10);
  });
});

describe('formatDuration', () => {
  it('formats minutes under 60', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(23)).toBe('23 min');
    expect(formatDuration(59)).toBe('59 min');
  });

  it('formats hours and minutes for 60 and above', () => {
    expect(formatDuration(60)).toBe('1 h 00 min');
    expect(formatDuration(65)).toBe('1 h 05 min');
    expect(formatDuration(125)).toBe('2 h 05 min');
  });
});

describe('formatClock', () => {
  it('formats in timezone correctly', () => {
    // 2026-10-11T09:41:00Z in Asia/Kolkata (+05:30) is 3:11 PM
    const res = formatClock('2026-10-11T09:41:00Z', 'Asia/Kolkata');
    expect(res).toBe('3:11 PM');
  });
});

describe('formatTimer', () => {
  it('formats under an hour as mm:ss', () => {
    expect(formatTimer(0)).toBe('00:00');
    expect(formatTimer(59_000)).toBe('00:59');
    expect(formatTimer(65_000)).toBe('01:05');
    expect(formatTimer(3599_000)).toBe('59:59');
  });

  it('formats above an hour as h:mm:ss', () => {
    expect(formatTimer(3600_000)).toBe('1:00:00');
    expect(formatTimer(3665_000)).toBe('1:01:05');
  });
});

describe('timeLeft', () => {
  it('calculates time left when not overdue', () => {
    const now = '2026-10-11T10:00:00Z';
    const due = '2026-10-11T10:15:00Z';
    const res = timeLeft(due, now);
    expect(res.overdue).toBe(false);
    expect(res.ms).toBe(15 * 60 * 1000);
  });

  it('calculates time left when overdue', () => {
    const now = '2026-10-11T10:20:00Z';
    const due = '2026-10-11T10:15:00Z';
    const res = timeLeft(due, now);
    expect(res.overdue).toBe(true);
    expect(res.ms).toBe(5 * 60 * 1000);
  });
});

describe('passLabel', () => {
  it('formats shortCode and padded 4-digit number', () => {
    expect(passLabel('IITK', 421)).toBe('IITK · 0421');
    expect(passLabel('IITK', 1)).toBe('IITK · 0001');
    expect(passLabel('IITD', 9999)).toBe('IITD · 9999');
  });
});

describe('finishFor', () => {
  it('returns finish by thresholds', () => {
    expect(finishFor(0)).toBe('graphite');
    expect(finishFor(9)).toBe('graphite');
    expect(finishFor(10)).toBe('chrome');
    expect(finishFor(49)).toBe('chrome');
    expect(finishFor(50)).toBe('holo');
    expect(finishFor(100)).toBe('holo');
  });
});

describe('relativeTime', () => {
  it('formats relative times', () => {
    const now = new Date('2026-10-11T12:00:00Z');
    expect(relativeTime('2026-10-11T11:59:30Z', now)).toBe('just now');
    expect(relativeTime('2026-10-11T11:55:00Z', now)).toBe('5 min ago');
    expect(relativeTime('2026-10-11T10:00:00Z', now)).toBe('2 h ago');
  });
});
