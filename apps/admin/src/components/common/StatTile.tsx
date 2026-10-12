import React from 'react';
import { cn } from '@/lib/utils';
import { Kicker } from './Kicker';

export interface StatTileProps {
  label: string;
  value: number | string;
  sub?: string;
  tone?: 'default' | 'ok' | 'warn' | 'bad' | 'primary';
  className?: string;
}

export function StatTile({ label, value, sub, tone = 'default', className = '' }: StatTileProps) {
  const toneClasses = {
    default: 'text-fg',
    ok: 'text-ok',
    warn: 'text-warn',
    bad: 'text-bad',
    primary: 'text-primary',
  }[tone];

  return (
    <div
      className={cn(
        'p-5 rounded-card bg-surface border border-border shadow-xs flex flex-col justify-between gap-3',
        className,
      )}
    >
      <Kicker text={label} />
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            'text-4xl md:text-5xl font-black tracking-tight font-mono tabular-nums leading-none',
            toneClasses,
          )}
        >
          {value}
        </span>
        {sub && <span className="text-xs text-muted leading-tight">{sub}</span>}
      </div>
    </div>
  );
}
