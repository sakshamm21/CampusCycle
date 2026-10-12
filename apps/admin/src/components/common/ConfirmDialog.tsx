'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { en } from '@campuscycle/shared';
import { Loader2 } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  targetName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  targetName,
  confirmLabel = en.common.confirm,
  cancelLabel = en.common.cancel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Error handled by caller
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-display lowercase text-lg font-bold">{title}</DialogTitle>
          <DialogDescription className="text-muted text-xs leading-relaxed">
            {description}
            {targetName && (
              <span className="block mt-1 font-mono font-bold text-fg">Target: {targetName}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="rounded-full border-border bg-surface hover:bg-surface2 text-xs font-mono cursor-pointer"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className={`rounded-full text-xs font-mono font-bold cursor-pointer ${
              destructive
                ? 'bg-bad text-white hover:bg-bad/90'
                : 'bg-primary text-on-primary hover:opacity-90'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />
                <span>Working...</span>
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
