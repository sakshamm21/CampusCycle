'use client';

import React from 'react';
import { en } from '@campuscycle/shared';
import { Info } from 'lucide-react';

export function DemoBanner() {
  return (
    <div
      role="status"
      className="w-full px-4 py-2 bg-primary/15 border-b border-primary/30 text-primary flex items-center justify-center gap-2 text-xs font-mono tracking-wide"
    >
      <Info className="size-3.5 shrink-0" />
      <span>{en.common.demo_banner_admin}</span>
    </div>
  );
}
