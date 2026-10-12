'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import type QrScanner from 'qr-scanner';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface QrScannerViewProps {
  onDecode: (result: string) => void;
  active?: boolean;
  manualPlaceholder?: string;
  onManualSubmit?: (code: string) => void;
  className?: string;
}

export function QrScannerView({
  onDecode,
  active = true,
  manualPlaceholder = 'e.g. K-042 or scan URL',
  onManualSubmit,
  className = '',
}: QrScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraDenied, setCameraDenied] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');
  const lastScanRef = useRef<number>(0);
  const scannerRef = useRef<QrScanner | null>(null);

  const initScanner = useCallback(async () => {
    if (!videoRef.current || !active) return;

    try {
      setCameraDenied(false);
      const QrScannerModule = (await import('qr-scanner')).default;

      if (scannerRef.current) {
        scannerRef.current.destroy();
        scannerRef.current = null;
      }

      const scanner = new QrScannerModule(
        videoRef.current,
        (result: QrScanner.ScanResult | string) => {
          const raw = typeof result === 'string' ? result : result.data;
          if (!raw) return;

          const now = Date.now();
          if (now - lastScanRef.current < 2000) {
            return;
          }
          lastScanRef.current = now;
          onDecode(raw);
        },
        {
          preferredCamera: 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
        },
      );

      scannerRef.current = scanner;
      await scanner.start();
    } catch (err: unknown) {
      console.warn('QR scanner failed to start:', err);
      setCameraDenied(true);
    }
  }, [active, onDecode]);

  useEffect(() => {
    if (active) {
      initScanner();
    } else {
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
        scannerRef.current = null;
      }
    };
  }, [active, initScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    if (onManualSubmit) {
      onManualSubmit(manualInput.trim());
    } else {
      onDecode(manualInput.trim());
    }
    setManualInput('');
  };

  return (
    <div className={cn('flex flex-col items-center gap-4 w-full', className)}>
      {/* Square video viewfinder max 420px, radius 22 */}
      <div className="relative w-full max-w-[420px] aspect-square rounded-[22px] overflow-hidden bg-black/95 border border-border shadow-md flex items-center justify-center">
        {cameraDenied ? (
          <div className="w-full h-full p-6 flex items-center justify-center bg-surface">
            <ErrorState
              error={{ code: 'CC_CAMERA_DENIED' }}
              onRetry={initScanner}
              className="border-0 bg-transparent py-4"
            />
          </div>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

            {/* Viewfinder Reticle Corners */}
            <div className="absolute inset-10 pointer-events-none rounded-xl border border-white/20">
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-primary rounded-tl" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-primary rounded-tr" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-primary rounded-bl" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-primary rounded-br" />

              {/* Scanning Laser Guide */}
              <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-primary/60 shadow-[0_0_8px_rgba(255,221,0,0.8)] animate-pulse" />
            </div>

            {/* Status indicator pill */}
            <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none">
              <span className="px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-black/70 text-white/90 backdrop-blur-xs flex items-center gap-1.5 border border-white/10">
                <span className="size-2 rounded-full bg-ok animate-ping" />
                scanning active
              </span>
            </div>
          </>
        )}
      </div>

      {/* Manual Input Fallback */}
      <form onSubmit={handleManualSubmit} className="w-full max-w-[420px] flex items-center gap-2">
        <Input
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder={manualPlaceholder}
          className="h-10 text-xs font-mono bg-surface border-border flex-1"
        />
        <Button
          type="submit"
          disabled={!manualInput.trim()}
          variant="outline"
          className="h-10 px-4 rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 cursor-pointer shrink-0"
        >
          <ArrowRight className="size-3.5 mr-1" />
          Enter
        </Button>
      </form>
    </div>
  );
}
