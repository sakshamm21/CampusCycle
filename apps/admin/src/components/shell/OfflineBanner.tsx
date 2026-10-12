'use client';

import React, { useState, useEffect } from 'react';
import { en } from '@campuscycle/shared';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="w-full px-4 py-2 bg-warn/15 border-b border-warn/30 text-warn flex items-center justify-center gap-2 text-xs font-mono tracking-wide"
    >
      <WifiOff className="size-3.5 shrink-0" />
      <span>{en.common.offline}</span>
    </div>
  );
}
