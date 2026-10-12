import React from 'react';
import { cn } from '@/lib/utils';

export interface KickerProps {
  text?: string;
  label?: string;
  live?: boolean;
  className?: string;
}

export function Kicker({ text, label, live = false, className = '' }: KickerProps) {
  const content = text ?? label ?? '';
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {live && (
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-75" />
          <span className="relative inline-flex rounded-full size-2 bg-ok" />
        </span>
      )}
      <span className="font-mono text-xs uppercase tracking-widest text-muted font-medium">{content}</span>
    </div>
  );
}
