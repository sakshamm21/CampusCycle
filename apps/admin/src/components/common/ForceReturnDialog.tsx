'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/browser';
import { forceReturn, messageFor, toAppError, en, t } from '@campuscycle/shared';

export interface ForceReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId?: string;
  bikeCode?: string;
  defaultStandId?: string;
  stands: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function ForceReturnDialog({
  open,
  onOpenChange,
  rideId,
  bikeCode = 'bike',
  defaultStandId,
  stands,
  onSuccess,
}: ForceReturnDialogProps) {
  const db = supabase;
  const [standId, setStandId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [addStrike, setAddStrike] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setStandId(defaultStandId || stands[0]?.id || '');
      setNote('');
      setAddStrike(false);
    }
  }, [open, defaultStandId, stands]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rideId || !standId || note.trim().length < 3) return;

    setLoading(true);
    try {
      await forceReturn(db, rideId, standId, note.trim(), addStrike);
      toast.success(`Bike ${bikeCode} returned successfully`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-display lowercase text-lg font-bold">
            {t('a07.force_title', { bike: bikeCode })}
          </DialogTitle>
          <DialogDescription className="text-muted text-xs">
            End the active ride and return the bike to a designated campus stand.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="force-stand" className="text-xs font-mono text-muted">
              {en.a07.force_stand}
            </Label>
            <Select value={standId} onValueChange={(val) => setStandId(val || '')}>
              <SelectTrigger id="force-stand" className="bg-surface2/60 border-border text-xs font-mono">
                <SelectValue placeholder="Select target stand" />
              </SelectTrigger>
              <SelectContent className="bg-surface border-border text-xs font-mono">
                {stands.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="force-note" className="text-xs font-mono text-muted">
              {en.a07.force_note}
            </Label>
            <Textarea
              id="force-note"
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for ending ride..."
              rows={3}
              className="text-xs bg-surface2/60 border-border resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="add-strike"
              checked={addStrike}
              onCheckedChange={(checked) => setAddStrike(Boolean(checked))}
              className="cursor-pointer"
            />
            <Label htmlFor="add-strike" className="text-xs font-mono text-fg cursor-pointer select-none">
              {en.a07.add_strike}
            </Label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
              className="rounded-full border-border bg-surface text-xs font-mono cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !standId || note.trim().length < 3}
              className="rounded-full text-xs font-mono font-bold bg-bad text-white hover:bg-bad/90 cursor-pointer"
            >
              {loading ? 'Processing...' : en.a07.force}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
