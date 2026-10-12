import React from 'react';
import { cn } from '@/lib/utils';
import { Sticker, type StickerColor } from './Sticker';
import { Headline } from './Headline';

export interface EmptyStateProps {
  stickerText?: string;
  stickerColor?: StickerColor;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  stickerText = 'empty',
  stickerColor = 'yellow',
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'w-full py-16 px-6 rounded-card border border-dashed border-border bg-surface/40 flex flex-col items-center justify-center text-center gap-4',
        className,
      )}
    >
      {stickerText && (
        <div className="mb-2">
          <Sticker text={stickerText} color={stickerColor} rotate={-3} />
        </div>
      )}
      <Headline text={title} size="m" className="text-center" />
      {description && <p className="text-muted text-sm max-w-md leading-relaxed">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
