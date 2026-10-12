'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';

export function TorqFab() {
  const pathname = usePathname();
  const router = useRouter();

  // Hidden on A13 TORQ console
  if (pathname === '/torq' || pathname?.startsWith('/torq/')) {
    return null;
  }

  return (
    <button
      onClick={() => router.push('/torq')}
      aria-label="Open TORQ Console"
      className="fixed bottom-20 lg:bottom-6 right-6 z-40 size-10 rounded-[14px] bg-fg text-bg shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center cursor-pointer group"
    >
      <Sparkles className="size-5 fill-current transition-transform group-hover:rotate-12" />
    </button>
  );
}
