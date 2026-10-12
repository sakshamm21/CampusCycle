'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  UserCheck,
  QrCode,
  MapPin,
  AlertCircle,
  Bike,
  Layers,
  Tag,
  Warehouse,
  Users,
  Sparkles,
  Activity,
  BarChart3,
  Settings,
  FileText,
  Building2,
  ExternalLink,
  Moon,
  Sun,
  Laptop,
  LogOut,
  User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import { useTheme } from '@/lib/providers';
import { dashboardStats } from '@campuscycle/shared';
import type { MyContext } from '@campuscycle/shared';
import { CollegeSwitcher } from './CollegeSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: 'pending_approvals' | 'open_issues';
  superAdminOnly?: boolean;
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    name: 'Operate',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Approvals', href: '/approvals', icon: UserCheck, badgeKey: 'pending_approvals' },
      { label: 'Scan', href: '/scan', icon: QrCode },
      { label: 'Live map', href: '/map', icon: MapPin },
      { label: 'Issues', href: '/issues', icon: AlertCircle, badgeKey: 'open_issues' },
    ],
  },
  {
    name: 'Fleet',
    items: [
      { label: 'Rides', href: '/rides', icon: Bike },
      { label: 'Bikes', href: '/bikes', icon: Layers },
      { label: 'QR labels', href: '/bikes/labels', icon: Tag },
      { label: 'Stands', href: '/stands', icon: Warehouse },
    ],
  },
  {
    name: 'People',
    items: [{ label: 'Users & passes', href: '/users', icon: Users }],
  },
  {
    name: 'TORQ',
    items: [
      { label: 'Console', href: '/torq', icon: Sparkles },
      { label: 'Traces', href: '/torq/traces', icon: Activity },
      { label: 'AI usage', href: '/torq/usage', icon: BarChart3 },
    ],
  },
  {
    name: 'College',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings },
      { label: 'Audit log', href: '/audit', icon: FileText },
      { label: 'Colleges', href: '/colleges', icon: Building2, superAdminOnly: true },
    ],
  },
];

export function Sidebar({ ctx, onNavigate }: { ctx: MyContext; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { collegeId } = useCollege();
  const { theme, setTheme } = useTheme();

  const isSuperAdmin = ctx.profile.role === 'super_admin' || ctx.profile.is_owner;
  const riderWebUrl = process.env.NEXT_PUBLIC_RIDER_WEB_URL || 'https://campuscycle-ride.vercel.app';

  const { data: stats } = useQuery({
    queryKey: ['stats', collegeId],
    queryFn: () => dashboardStats(supabase, collegeId),
    enabled: !!collegeId,
    refetchInterval: 60_000,
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/sign-in');
  };

  const cycleTheme = () => {
    if (theme === 'dark') setTheme('day');
    else if (theme === 'day') setTheme('system');
    else setTheme('dark');
  };

  const getInitials = (name?: string) => {
    if (!name) return 'A';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <aside className="w-full lg:w-[248px] h-full flex flex-col justify-between bg-surface border-r border-border p-4 select-none">
      {/* Top section: Wordmark + College switcher */}
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        <div className="flex items-center justify-between px-2 pt-1">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="flex items-center gap-1.5 focus:outline-hidden"
          >
            <span className="font-display font-black text-2xl tracking-tight text-fg lowercase">
              campus
              <span className="font-accent italic font-normal text-primary text-[1.12em] -ml-0.5">cycle</span>
            </span>
          </Link>
          {ctx.profile.is_demo && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold bg-primary/20 text-primary border border-primary/30">
              Demo
            </span>
          )}
        </div>

        <div className="px-1">
          <CollegeSwitcher isSuperAdmin={isSuperAdmin} />
        </div>

        {/* Nav groups */}
        <nav className="flex flex-col gap-5 mt-1 flex-1 min-h-0 overflow-y-auto pr-1">
          {NAV_GROUPS.map((group) => {
            const filteredItems = group.items.filter((item) => !item.superAdminOnly || isSuperAdmin);
            if (filteredItems.length === 0) return null;

            return (
              <div key={group.name} className="flex flex-col gap-1">
                <span className="px-2.5 text-[10px] font-mono uppercase font-bold tracking-widest text-muted/80">
                  {group.name}
                </span>
                <div className="flex flex-col gap-0.5">
                  {filteredItems.map((item) => {
                    const isActive =
                      item.href === '/dashboard'
                        ? pathname === '/dashboard'
                        : pathname === item.href || pathname?.startsWith(item.href + '/');

                    const badgeCount =
                      item.badgeKey && stats ? ((stats as Record<string, number>)[item.badgeKey] ?? 0) : 0;

                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-full text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-surface2 text-fg font-semibold shadow-xs'
                            : 'text-muted hover:text-fg hover:bg-surface2/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={`size-4 ${
                              isActive ? 'text-primary stroke-[2.2]' : 'text-muted stroke-[1.8]'
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>
                        {badgeCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-primary text-on-primary">
                            {badgeCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Rider App external link */}
          <div className="pt-2 border-t border-border/60">
            <a
              href={riderWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-2.5 py-1.5 rounded-full text-xs font-mono text-muted hover:text-fg hover:bg-surface2/50 transition-colors"
            >
              <span>Rider app</span>
              <ExternalLink className="size-3 text-muted" />
            </a>
          </div>
        </nav>
      </div>

      {/* Bottom section: Theme toggle + Avatar menu */}
      <div className="pt-3 border-t border-border flex items-center justify-between px-1">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 hover:opacity-85 transition-opacity cursor-pointer text-left outline-hidden">
            <Avatar className="size-8 rounded-full border border-border bg-surface2 text-fg">
              <AvatarFallback className="text-xs font-mono font-bold bg-surface2 text-fg">
                {getInitials(ctx.profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col truncate max-w-[130px]">
              <span className="text-xs font-semibold text-fg truncate">
                {ctx.profile.full_name || 'Admin'}
              </span>
              <span className="text-[10px] font-mono text-muted truncate">
                {isSuperAdmin ? 'Super Admin' : 'College Admin'}
              </span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 bg-surface border-border">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-medium leading-none text-fg">{ctx.profile.full_name}</p>
                <p className="text-[11px] leading-none text-muted font-mono truncate">{ctx.profile.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={() => {
                onNavigate?.();
                router.push('/account');
              }}
              className="cursor-pointer text-xs"
            >
              <User className="size-3.5 mr-2" />
              <span>My account</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer text-xs text-bad focus:text-bad"
            >
              <LogOut className="size-3.5 mr-2" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme toggle button */}
        <button
          onClick={cycleTheme}
          aria-label={`Current theme: ${theme}. Click to switch theme.`}
          className="size-8 rounded-full flex items-center justify-center text-muted hover:text-fg hover:bg-surface2 transition-colors cursor-pointer"
        >
          {theme === 'dark' && <Moon className="size-4" />}
          {theme === 'day' && <Sun className="size-4 text-warn" />}
          {theme === 'system' && <Laptop className="size-4" />}
        </button>
      </div>
    </aside>
  );
}
