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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { en } from '@campuscycle/shared';
import { Loader2 } from 'lucide-react';

export interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  targetName?: string;
  reasonLabel?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  minChars?: number;
  onConfirm: (reason: string) => Promise<void> | void;
}

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  targetName,
  reasonLabel = 'Reason (required, min 3 characters)',
  placeholder = 'Add details or rationale...',
  confirmLabel = en.common.confirm,
  cancelLabel = en.common.cancel,
  destructive = false,
  minChars = 3,
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const isReasonValid = reason.trim().length >= minChars;

  const handleConfirm = async () => {
    if (!isReasonValid) return;
    try {
      setLoading(true);
      await onConfirm(reason.trim());
      setReason('');
      onOpenChange(false);
    } catch {
      // Error handled by caller
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setReason('');
        onOpenChange(nextOpen);
      }}
    >
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

        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor="dialog-reason" className="text-xs font-mono text-muted">
            {reasonLabel}
          </Label>
          <Textarea
            id="dialog-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="text-xs bg-surface2/60 border-border resize-none"
          />
          {reason.length > 0 && !isReasonValid && (
            <span className="text-[11px] text-bad font-mono">
              Reason must be at least {minChars} characters
            </span>
          )}
        </div>

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
            disabled={loading || !isReasonValid}
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
