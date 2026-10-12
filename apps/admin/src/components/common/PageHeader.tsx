import React from 'react';
import { Kicker } from './Kicker';
import { Headline } from './Headline';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  kicker?: string;
  title: string;
  lede?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ kicker, title, lede, actions, className = '' }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border',
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        {kicker && <Kicker text={kicker} />}
        <Headline text={title} size="l" />
        {lede && <p className="text-muted text-sm max-w-2xl">{lede}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}
