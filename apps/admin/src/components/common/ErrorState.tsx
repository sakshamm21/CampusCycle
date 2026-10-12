import React from 'react';
import { TriangleAlert, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { messageFor, toAppError, en } from '@campuscycle/shared';
import { Button } from '@/components/ui/button';

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ error, onRetry, className = '' }: ErrorStateProps) {
  const appError = toAppError(error);
  const isNetwork = appError.code === 'CC_NETWORK';
  const Icon = isNetwork ? CloudOff : TriangleAlert;
  const message = messageFor(appError.code, appError.data);

  return (
    <div
      role="alert"
      className={cn(
        'w-full py-12 px-6 rounded-card border border-bad/30 bg-bad/5 flex flex-col items-center justify-center text-center gap-3',
        className,
      )}
    >
      <div className="size-12 rounded-full bg-bad/15 flex items-center justify-center text-bad mb-1">
        <Icon className="size-6" />
      </div>
      <h3 className="font-display font-bold text-lg text-fg lowercase">something went wrong</h3>
      <p className="text-muted text-sm max-w-md leading-relaxed">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="mt-2 rounded-full border-border bg-surface hover:bg-surface2 text-xs font-mono cursor-pointer"
        >
          {en.common.retry}
        </Button>
      )}
    </div>
  );
}
