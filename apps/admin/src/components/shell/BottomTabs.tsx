'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { QrCode, UserCheck, MapPin, Sparkles, Menu } from 'lucide-react';
import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import { dashboardStats } from '@campuscycle/shared';

export function BottomTabs({ onOpenMore }: { onOpenMore: () => void }) {
  const pathname = usePathname();
  const { collegeId } = useCollege();

  const { data: stats } = useQuery({
    queryKey: ['stats', collegeId],
    queryFn: () => dashboardStats(supabase, collegeId),
    enabled: !!collegeId,
    refetchInterval: 60_000,
  });

  const pendingApprovals = stats ? ((stats as Record<string, number>).pending_approvals ?? 0) : 0;

  const tabs = [
    { label: 'Scan', href: '/scan', icon: QrCode },
    {
      label: 'Approvals',
      href: '/approvals',
      icon: UserCheck,
      badge: pendingApprovals,
    },
    { label: 'Map', href: '/map', icon: MapPin },
    { label: 'TORQ', href: '/torq', icon: Sparkles },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border z-30 flex items-center justify-around px-2 select-none">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname?.startsWith(tab.href + '/');
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex flex-col items-center justify-center gap-1 w-14 h-12 rounded-xl transition-colors ${
              isActive ? 'text-primary font-bold' : 'text-muted hover:text-fg'
            }`}
          >
            <div className="relative">
              <Icon className="size-5" />
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute -top-1 -right-2 px-1 min-w-3.5 h-3.5 rounded-full text-[9px] font-mono font-bold bg-primary text-on-primary flex items-center justify-center">
                  {tab.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] tracking-tight">{tab.label}</span>
          </Link>
        );
      })}

      {/* More tab button */}
      <button
        onClick={onOpenMore}
        className="flex flex-col items-center justify-center gap-1 w-14 h-12 rounded-xl text-muted hover:text-fg transition-colors cursor-pointer"
        aria-label="More navigation options"
      >
        <Menu className="size-5" />
        <span className="text-[10px] tracking-tight">More</span>
      </button>
    </nav>
  );
}
