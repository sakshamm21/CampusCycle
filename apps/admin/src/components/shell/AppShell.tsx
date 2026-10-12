'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { BottomTabs } from './BottomTabs';
import { DemoBanner } from './DemoBanner';
import { OfflineBanner } from './OfflineBanner';
import { TorqFab } from '@/components/torq/TorqFab';
import { useCollege } from '@/lib/scope';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { MyContext } from '@campuscycle/shared';

export function AppShell({ children, ctx }: { children: React.ReactNode; ctx: MyContext }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { college } = useCollege();

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col font-sans antialiased selection:bg-primary/20 selection:text-primary">
      {/* Network offline banner */}
      <OfflineBanner />

      {/* Mobile top bar (< 1024px) */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-surface border-b border-border flex items-center justify-between px-4 select-none">
        <Link href="/dashboard" className="flex items-center gap-1.5 focus:outline-hidden">
          <span className="font-display font-black text-xl tracking-tight text-fg lowercase">
            campus
            <span className="font-accent italic font-normal text-primary text-[1.12em] -ml-0.5">cycle</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {college?.short_code && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase bg-surface2 text-fg border border-border">
              {college.short_code}
            </span>
          )}
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface2 transition-colors cursor-pointer"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      {/* Demo Banner */}
      {ctx.profile.is_demo && <DemoBanner />}

      {/* Layout Container */}
      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar (>= 1024px) */}
        <div className="hidden lg:block shrink-0 sticky top-0 h-screen">
          <Sidebar ctx={ctx} />
        </div>

        {/* Mobile Sidebar Sheet */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-[280px] bg-surface border-r border-border">
            <Sidebar ctx={ctx} onNavigate={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 flex flex-col items-center">
          <div className="w-full max-w-[1280px] p-4 lg:p-8 pb-24 lg:pb-12 min-h-full">{children}</div>
        </main>
      </div>

      {/* Bottom Tabs on mobile */}
      <BottomTabs onOpenMore={() => setMobileMenuOpen(true)} />

      {/* Floating TORQ action button */}
      <TorqFab />
    </div>
  );
}
