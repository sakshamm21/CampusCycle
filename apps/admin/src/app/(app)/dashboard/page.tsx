'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import { useMyContext } from '@/lib/providers';
import {
  dashboardStats,
  ridesPerDay,
  moveBikes,
  setInsightStatus,
  relativeTime,
  toAppError,
  messageFor,
  t,
  en,
} from '@campuscycle/shared';

import { PageHeader } from '@/components/common/PageHeader';
import { StatTile } from '@/components/common/StatTile';
import { Kicker } from '@/components/common/Kicker';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface DigestItem {
  n: string;
  text: string;
}

interface DigestContent {
  title?: string;
  items?: DigestItem[];
  run_id?: string;
}

interface RebalancingMove {
  from_stand_id: string;
  from_name: string;
  to_stand_id: string;
  to_name: string;
  count: number;
  bike_codes: string[];
  by_hour: number;
  reason: string;
}

interface RebalancingContent {
  moves?: RebalancingMove[];
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { collegeId, college } = useCollege();
  const ctx = useMyContext();
  const [mounted, setMounted] = useState(false);
  const [rebalConfirmOpen, setRebalConfirmOpen] = useState(false);
  const [pendingMoveList, setPendingMoveList] = useState<{ bike_code: string; stand_id: string }[]>([]);
  const [pendingInsightId, setPendingInsightId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Dashboard stats query (refetched every 60s and on realtime)
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['stats', collegeId],
    queryFn: async () => {
      if (!collegeId) return null;
      return dashboardStats(supabase, collegeId) as Promise<{
        bikes_available: number;
        bikes_borrowed: number;
        bikes_maintenance: number;
        bikes_missing: number;
        bikes_total: number;
        rides_active: number;
        rides_overdue: number;
        avg_ride_minutes_7d: number;
        pending_approvals: number;
        pending_id_match: number;
        open_issues: number;
        rides_yesterday: number;
        overdue_example: { bike: string; pass: string } | null;
      }>;
    },
    enabled: Boolean(collegeId),
    refetchInterval: 60_000,
  });

  // 2. Rides per day query (30 days)
  const { data: rawRidesPerDay, isLoading: ridesLoading } = useQuery({
    queryKey: ['ridesPerDay', collegeId],
    queryFn: async () => {
      if (!collegeId) return [];
      return ridesPerDay(supabase, collegeId, 30);
    },
    enabled: Boolean(collegeId),
  });

  // 3. AI Insights query: Q9 digest & rebalancing
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['insights', collegeId, ['digest', 'rebalancing']],
    queryFn: async () => {
      if (!collegeId) return [];
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('college_id', collegeId)
        .eq('status', 'active')
        .in('kind', ['digest', 'rebalancing'])
        .order('created_at', { ascending: false });

      if (error) throw toAppError(error);
      return data ?? [];
    },
    enabled: Boolean(collegeId),
  });

  if (statsError) {
    return <ErrorState error={statsError} onRetry={() => refetchStats()} />;
  }

  // Greeting logic
  const tz = college?.time_zone || 'Asia/Kolkata';
  const localHour = mounted ? parseInt(formatInTimeZone(new Date(), tz, 'H'), 10) : 10;
  const part = localHour < 12 ? 'morning' : localHour < 17 ? 'afternoon' : 'evening';
  const firstName = ctx?.profile?.full_name ? ctx.profile.full_name.split(' ')[0] : 'admin';
  const greeting = t('a02.title', { part, first: firstName });
  const todayFormatted = mounted ? formatInTimeZone(new Date(), tz, 'EEEE, d MMMM') : '';

  // Extract latest digest & rebalancing insight
  const digestInsight = insights?.find((i) => i.kind === 'digest');
  const digestContent = (digestInsight?.content as unknown as DigestContent) || null;

  const rebalInsight = insights?.find((i) => i.kind === 'rebalancing');
  const rebalContent = (rebalInsight?.content as unknown as RebalancingContent) || null;
  const rebalMoves = rebalContent?.moves || [];

  // Chart data preparation
  const chartData = (rawRidesPerDay || []).map((item) => {
    const parsedDate = new Date(item.day);
    return {
      rawDay: item.day,
      formattedDay: format(parsedDate, 'd MMM'),
      rides: item.rides,
    };
  });

  // Rebalancing action handlers
  const handleOpenRebalConfirm = () => {
    if (!rebalInsight || !rebalMoves.length) return;
    const moves: { bike_code: string; stand_id: string }[] = [];
    for (const move of rebalMoves) {
      for (const code of move.bike_codes) {
        moves.push({ bike_code: code, stand_id: move.to_stand_id });
        if (moves.length >= 20) break;
      }
      if (moves.length >= 20) break;
    }
    setPendingMoveList(moves);
    setPendingInsightId(rebalInsight.id);
    setRebalConfirmOpen(true);
  };

  const handleApplyRebalance = async () => {
    if (!pendingInsightId || !pendingMoveList.length) return;
    try {
      await moveBikes(supabase, pendingMoveList);
      await setInsightStatus(supabase, pendingInsightId, 'accepted');
      toast.success(en.common.done);
      queryClient.invalidateQueries({ queryKey: ['stats', collegeId] });
      queryClient.invalidateQueries({ queryKey: ['insights', collegeId] });
      queryClient.invalidateQueries({ queryKey: ['bikes'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  const handleDismissRebalance = async () => {
    if (!rebalInsight) return;
    try {
      await setInsightStatus(supabase, rebalInsight.id, 'dismissed');
      toast.success(en.common.done);
      queryClient.invalidateQueries({ queryKey: ['insights', collegeId] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        kicker={todayFormatted}
        live={true}
        title={greeting}
        lede="CampusCycle operations command center."
      />

      {/* 2. Digest Card */}
      <section className="w-full rounded-card border border-border border-l-4 border-l-primary bg-surface p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Kicker text={en.a02.digest_kicker} live={true} />
          {digestInsight && (
            <span className="text-xs font-mono text-muted">
              {t('a02.digest_time', { relative: relativeTime(digestInsight.created_at) })}
            </span>
          )}
        </div>

        {insightsLoading ? (
          <div className="flex flex-col gap-3 py-2">
            <Skeleton className="h-6 w-3/4 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
          </div>
        ) : digestContent?.items && digestContent.items.length > 0 ? (
          <div className="flex flex-col gap-4">
            {digestContent.title && (
              <h3 className="font-display font-black text-xl tracking-tight text-fg lowercase">
                {digestContent.title}
              </h3>
            )}
            <div className="grid gap-3 pt-1">
              {digestContent.items.map((item, idx) => (
                <div key={idx} className="flex items-baseline gap-3">
                  <span className="font-mono text-xl md:text-2xl font-black tabular-nums text-primary shrink-0 min-w-8">
                    {item.n}
                  </span>
                  <span className="text-sm text-fg leading-snug">{item.text}</span>
                </div>
              ))}
            </div>
            {digestInsight?.run_id && (
              <div className="pt-2 border-t border-border flex justify-end">
                <Link
                  href={`/torq/traces/${digestInsight.run_id}`}
                  className="inline-flex items-center gap-1 text-xs font-mono text-muted hover:text-fg transition-colors"
                >
                  <span>View trace</span>
                  <ArrowUpRight className="size-3" />
                </Link>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted italic py-2">{en.a02.digest_empty}</p>
        )}
      </section>

      {/* 3. Stat Tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-card" />)
        ) : (
          <>
            {/* Bikes Available */}
            <StatTile label={en.a02.stat_available} value={stats?.bikes_available ?? 0} tone="ok" />
            {/* Bikes Borrowed */}
            <StatTile label={en.a02.stat_borrowed} value={stats?.bikes_borrowed ?? 0} tone="default" />
            {/* In Maintenance */}
            <StatTile label={en.a02.stat_maintenance} value={stats?.bikes_maintenance ?? 0} tone="warn" />
            {/* Missing Bikes */}
            <StatTile
              label={en.a02.stat_missing}
              value={stats?.bikes_missing ?? 0}
              tone={(stats?.bikes_missing ?? 0) > 0 ? 'bad' : 'default'}
            />
            {/* Active Rides */}
            <StatTile label={en.a02.stat_active} value={stats?.rides_active ?? 0} tone="default" />
            {/* Overdue Rides */}
            <StatTile
              label={en.a02.stat_overdue}
              value={stats?.rides_overdue ?? 0}
              tone={(stats?.rides_overdue ?? 0) > 0 ? 'bad' : 'default'}
              sub={
                (stats?.rides_overdue ?? 0) > 0 && stats?.overdue_example
                  ? `${stats.overdue_example.bike} · ${stats.overdue_example.pass}`
                  : undefined
              }
            />
            {/* Pending Approvals */}
            <Link href="/approvals" className="block focus:outline-none">
              <StatTile
                label={en.a02.stat_pending}
                value={stats?.pending_approvals ?? 0}
                tone={(stats?.pending_approvals ?? 0) > 0 ? 'primary' : 'default'}
                sub={t('a02.stat_id', { n: stats?.pending_id_match ?? 0 })}
                className="hover:border-primary/50 transition-colors cursor-pointer"
              />
            </Link>
            {/* Open Issues */}
            <Link href="/issues" className="block focus:outline-none">
              <StatTile
                label={en.a02.stat_issues}
                value={stats?.open_issues ?? 0}
                tone={(stats?.open_issues ?? 0) > 0 ? 'warn' : 'default'}
                className="hover:border-primary/50 transition-colors cursor-pointer"
              />
            </Link>
          </>
        )}
      </section>

      {/* 4. Rides Per Day Chart & Avg Ride Tile */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Chart Column (3 cols on desktop) */}
        <div className="lg:col-span-3 p-6 rounded-card border border-border bg-surface shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-display font-extrabold text-base tracking-tight text-fg lowercase">
              {en.a02.chart_title}
            </span>
            <span className="text-xs font-mono text-muted uppercase">Past 30 days</span>
          </div>

          <div className="h-[220px] w-full pt-2">
            {ridesLoading || !mounted ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis
                    dataKey="formattedDay"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-martian)' }}
                    interval={4}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-martian)' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-surface border border-border px-3 py-1.5 rounded-lg shadow-md text-xs font-mono">
                            <span className="font-bold text-fg">{item.rides}</span> rides on{' '}
                            {item.formattedDay}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="rides" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === chartData.length - 1 ? 'var(--fg)' : 'var(--primary)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted font-mono">
                No ride data recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Average ride duration tile (1 col on desktop) */}
        <div className="lg:col-span-1 flex flex-col justify-between">
          <StatTile
            label="avg ride"
            value={`${stats?.avg_ride_minutes_7d ?? 0}m`}
            sub={t('a02.avg', { n: stats?.avg_ride_minutes_7d ?? 0 })}
            className="h-full justify-between"
          />
        </div>
      </section>

      {/* 5. Rebalancing Card */}
      <section className="w-full rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Kicker text={en.a02.rebal_kicker} live={true} />
        </div>

        {insightsLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : rebalMoves.length > 0 ? (
          <div className="flex flex-col gap-4">
            <div className="divide-y divide-border">
              {rebalMoves.map((move, idx) => (
                <div
                  key={idx}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-sm font-bold text-fg">
                      {move.count} bikes · {move.from_name} → {move.to_name} · by{' '}
                      {String(move.by_hour).padStart(2, '0')}:00
                    </span>
                    <span className="text-xs text-muted leading-relaxed">{move.reason}</span>
                  </div>
                  <span className="font-mono text-[11px] text-muted shrink-0">
                    Bikes: {move.bike_codes.join(', ')}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleDismissRebalance}
                className="rounded-full text-xs font-mono text-muted hover:text-fg cursor-pointer"
              >
                {en.a02.rebal_dismiss}
              </Button>
              <Button
                type="button"
                onClick={handleOpenRebalConfirm}
                className="rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer"
              >
                {en.a02.rebal_apply}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted italic py-2">{en.a02.rebal_empty}</p>
        )}
      </section>

      {/* Confirm dialog for rebalancing */}
      <ConfirmDialog
        open={rebalConfirmOpen}
        onOpenChange={setRebalConfirmOpen}
        title="Move these bikes?"
        description={`This will move ${pendingMoveList.length} bikes according to the TORQ rebalancing plan:`}
        targetName={pendingMoveList.map((m) => m.bike_code).join(', ')}
        confirmLabel="Confirm moves"
        onConfirm={handleApplyRebalance}
      />
    </div>
  );
}
