import React from 'react';
import { cn } from '@/lib/utils';

export type StatusTone = 'ok' | 'warn' | 'bad' | 'primary' | 'subtle';

export interface StatusPillProps {
  status: string;
  tone?: StatusTone;
  label?: string;
  className?: string;
}

export function getToneForStatus(status: string): StatusTone {
  const s = status.toLowerCase();
  switch (s) {
    case 'available':
    case 'ready':
    case 'approved':
    case 'resolved':
    case 'returned':
    case 'active':
      return 'ok';
    case 'borrowed':
    case 'riding':
      return 'primary';
    case 'maintenance':
    case 'overdue':
    case 'warn':
      return 'warn';
    case 'missing':
    case 'suspended':
    case 'rejected':
    case 'failed':
    case 'bad':
      return 'bad';
    case 'retired':
    case 'pending':
    case 'cancelled':
    default:
      return 'subtle';
  }
}

export function StatusPill({ status, tone, label, className = '' }: StatusPillProps) {
  const resolvedTone = tone ?? getToneForStatus(status);
  const displayLabel = label ?? status.replace(/_/g, ' ');

  const toneClasses = {
    ok: 'bg-ok/15 text-ok border-ok/25',
    warn: 'bg-warn/15 text-warn border-warn/25',
    bad: 'bg-bad/15 text-bad border-bad/25',
    primary: 'bg-primary/15 text-primary border-primary/25',
    subtle: 'bg-surface2 text-muted border-border',
  }[resolvedTone];

  const dotClasses = {
    ok: 'bg-ok',
    warn: 'bg-warn',
    bad: 'bg-bad',
    primary: 'bg-primary',
    subtle: 'bg-subtle',
  }[resolvedTone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider border select-none',
        toneClasses,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full shrink-0', dotClasses)} />
      <span className="truncate">{displayLabel}</span>
    </span>
  );
}
