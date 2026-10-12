'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, Search, Bot, Server, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import { useMyContext } from '@/lib/providers';
import { exportCsv } from '@/lib/csv';
import { t, en } from '@campuscycle/shared';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface AuditRow extends Record<string, unknown> {
  id: number;
  action: string;
  actor_id: string | null;
  college_id: string | null;
  confirmed_by: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
  is_demo: boolean;
  target_id: string | null;
  target_type: string | null;
  via: string;
  actor?: { full_name: string | null; email: string | null } | null;
  confirmer?: { full_name: string | null } | null;
}

const ACTION_PREFIXES = [
  { label: 'All Actions', value: '' },
  { label: 'rider.*', value: 'rider.' },
  { label: 'user.*', value: 'user.' },
  { label: 'ride.*', value: 'ride.' },
  { label: 'bike.*', value: 'bike.' },
  { label: 'stand.*', value: 'stand.' },
  { label: 'pass.*', value: 'pass.' },
  { label: 'issue.*', value: 'issue.' },
  { label: 'college.*', value: 'college.' },
  { label: 'ai.*', value: 'ai.' },
  { label: 'account.*', value: 'account.' },
];

const VIA_OPTIONS = [
  { label: 'All Via', value: '' },
  { label: 'App', value: 'app' },
  { label: 'Admin', value: 'admin' },
  { label: 'TORQ', value: 'torq' },
  { label: 'System', value: 'system' },
  { label: 'Cron', value: 'cron' },
];

export default function AuditLogPage() {
  const { collegeId, colleges } = useCollege();
  const ctx = useMyContext();
  const isSuperAdmin = ctx.profile.role === 'super_admin' || ctx.profile.is_owner;

  // Filter States
  const [selectedCollegeScope, setSelectedCollegeScope] = useState<string>(collegeId || 'ALL');
  const [actionPrefix, setActionPrefix] = useState<string>('');
  const [viaFilter, setViaFilter] = useState<string>('');
  const [searchActor, setSearchActor] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Expanded row details modal
  const [selectedDetails, setSelectedDetails] = useState<{
    action: string;
    id: number;
    details: Record<string, unknown> | null;
  } | null>(null);

  // 1. Fetch Audit Log (Q12)
  const {
    data: auditRows = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['audit-log', selectedCollegeScope, actionPrefix, viaFilter, dateFrom, dateTo, collegeId],
    queryFn: async (): Promise<AuditRow[]> => {
      let query = supabase
        .from('audit_log')
        .select(
          `
          id, action, actor_id, college_id, confirmed_by, created_at, details, is_demo, target_id, target_type, via,
          actor:profiles!audit_log_actor_id_fkey(full_name, email),
          confirmer:profiles!audit_log_confirmed_by_fkey(full_name)
        `,
        )
        .order('created_at', { ascending: false })
        .limit(200);

      // College Scope
      if (!isSuperAdmin) {
        query = query.eq('college_id', collegeId);
      } else if (selectedCollegeScope && selectedCollegeScope !== 'ALL') {
        query = query.eq('college_id', selectedCollegeScope);
      }

      // Action prefix filter
      if (actionPrefix) {
        query = query.ilike('action', `${actionPrefix}%`);
      }

      // Via filter
      if (viaFilter) {
        query = query.eq('via', viaFilter);
      }

      // Date range filter
      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        const nextDay = new Date(dateTo);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt('created_at', nextDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
  });

  // Client-side text filter for actor name / email / action
  const filteredRows = useMemo(() => {
    if (!searchActor.trim()) return auditRows;
    const term = searchActor.toLowerCase().trim();
    return auditRows.filter((row) => {
      const actorName = row.actor?.full_name?.toLowerCase() || '';
      const actorEmail = row.actor?.email?.toLowerCase() || '';
      const action = row.action.toLowerCase();
      const target = `${row.target_type ?? ''} ${row.target_id ?? ''}`.toLowerCase();
      return (
        actorName.includes(term) ||
        actorEmail.includes(term) ||
        action.includes(term) ||
        target.includes(term)
      );
    });
  }, [auditRows, searchActor]);

  // Export CSV Handler
  const handleExportCsv = () => {
    if (filteredRows.length === 0) {
      toast.error('No audit records to export');
      return;
    }

    const exportData = filteredRows.map((r) => {
      const actorLabel =
        r.actor?.full_name || r.actor?.email || (r.via === 'system' ? en.a17.system : 'Unknown');
      const targetLabel =
        (r.details?.label as string) ||
        (r.details?.code as string) ||
        `${r.target_type ?? ''} ${r.target_id ? r.target_id.slice(0, 8) : ''}`.trim();

      return {
        id: r.id,
        created_at: format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss'),
        actor: actorLabel,
        via: r.via,
        action: r.action,
        target: targetLabel,
        confirmed_by: r.confirmer?.full_name || '',
        details: r.details ? JSON.stringify(r.details) : '',
      };
    });

    exportCsv(`audit-log-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`, exportData, [
      { key: 'created_at', header: 'Timestamp' },
      { key: 'actor', header: en.a17.actor },
      { key: 'via', header: en.a17.via },
      { key: 'action', header: en.a17.action },
      { key: 'target', header: en.a17.target },
      { key: 'confirmed_by', header: en.a17.confirmed_by },
      { key: 'details', header: 'Details' },
    ]);

    toast.success('Audit log CSV exported.');
  };

  // Helper: target label
  const getTargetLabel = (row: AuditRow) => {
    if (row.details?.label && typeof row.details.label === 'string') {
      return row.details.label;
    }
    if (row.details?.code && typeof row.details.code === 'string') {
      return row.details.code;
    }
    if (row.target_type) {
      const shortId = row.target_id ? `:${row.target_id.slice(0, 8)}` : '';
      return `${row.target_type}${shortId}`;
    }
    return '—';
  };

  // Columns definition
  const columns: Column<AuditRow>[] = [
    {
      key: 'created_at',
      header: 'Time',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-[11px] text-muted whitespace-nowrap">
          {format(new Date(row.created_at), 'dd MMM HH:mm:ss')}
        </span>
      ),
    },
    {
      key: 'actor',
      header: en.a17.actor,
      sortable: true,
      render: (row) => {
        if (row.via === 'system') {
          return (
            <span className="flex items-center gap-1.5 text-xs font-mono text-muted">
              <Server className="size-3 text-muted/80" />
              <span>{en.a17.system}</span>
            </span>
          );
        }
        return (
          <div className="flex flex-col min-w-0 max-w-[160px]">
            <span className="font-medium text-xs text-fg truncate">{row.actor?.full_name || 'Admin'}</span>
            <span className="text-[10px] font-mono text-muted truncate">{row.actor?.email}</span>
          </div>
        );
      },
    },
    {
      key: 'via',
      header: en.a17.via,
      sortable: true,
      render: (row) => {
        const isTorq = row.via === 'torq';
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
              isTorq
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'bg-surface2 border border-border text-muted'
            }`}
          >
            {isTorq && <Bot className="size-3 text-primary" />}
            {row.via}
          </span>
        );
      },
    },
    {
      key: 'action',
      header: en.a17.action,
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-fg bg-surface2/60 px-1.5 py-0.5 rounded border border-border/50">
          {row.action}
        </span>
      ),
    },
    {
      key: 'target',
      header: en.a17.target,
      render: (row) => (
        <span className="font-mono text-xs text-muted truncate max-w-[150px] inline-block">
          {getTargetLabel(row)}
        </span>
      ),
    },
    {
      key: 'confirmed_by',
      header: en.a17.confirmed_by,
      render: (row) => (
        <span className="text-xs text-muted">
          {row.confirmer?.full_name || (row.via === 'torq' ? 'Auto / None' : '—')}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (row) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            setSelectedDetails({
              action: row.action,
              id: row.id,
              details: row.details,
            })
          }
          className="h-6 px-2 text-[11px] font-mono rounded-full text-muted hover:text-fg hover:bg-surface2"
        >
          JSON
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      <PageHeader
        kicker="compliance & security"
        title={t('a17.title')}
        lede="Immutable audit trail of all administrative actions, automated tasks, and TORQ copilot executions."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 gap-1.5 h-8"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin text-primary' : 'text-muted'}`} />
              <span>Refresh</span>
            </Button>
            <Button
              type="button"
              onClick={handleExportCsv}
              className="rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 gap-1.5 h-8 cursor-pointer"
            >
              <Download className="size-3.5" />
              <span>{en.a17.export}</span>
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="rounded-card border border-border bg-surface p-4 flex flex-wrap items-center gap-3 shadow-xs">
        {/* Super admin College Switcher */}
        {isSuperAdmin && (
          <div className="flex flex-col gap-1 min-w-[160px]">
            <span className="text-[10px] font-mono text-muted uppercase">Scope</span>
            <select
              value={selectedCollegeScope}
              onChange={(e) => setSelectedCollegeScope(e.target.value)}
              className="h-8 rounded-md border border-border bg-surface2 px-2 text-xs font-mono text-fg focus:outline-hidden"
            >
              <option value="ALL">All Colleges</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.short_code} · {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action Prefix Filter */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[10px] font-mono text-muted uppercase">{en.a17.action}</span>
          <select
            value={actionPrefix}
            onChange={(e) => setActionPrefix(e.target.value)}
            className="h-8 rounded-md border border-border bg-surface2 px-2 text-xs font-mono text-fg focus:outline-hidden"
          >
            {ACTION_PREFIXES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Via Filter */}
        <div className="flex flex-col gap-1 min-w-[110px]">
          <span className="text-[10px] font-mono text-muted uppercase">{en.a17.via}</span>
          <select
            value={viaFilter}
            onChange={(e) => setViaFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-surface2 px-2 text-xs font-mono text-fg focus:outline-hidden"
          >
            {VIA_OPTIONS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono text-muted uppercase">From</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 bg-surface2 border-border text-xs w-[130px]"
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono text-muted uppercase">To</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 bg-surface2 border-border text-xs w-[130px]"
          />
        </div>

        {/* Search input */}
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <span className="text-[10px] font-mono text-muted uppercase">Search</span>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted" />
            <Input
              placeholder="Filter by actor, action or target..."
              value={searchActor}
              onChange={(e) => setSearchActor(e.target.value)}
              className="h-8 pl-8 bg-surface2 border-border text-xs"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Data Table (50 per page) */}
      <DataTable
        columns={columns}
        data={filteredRows}
        loading={isLoading}
        pageSize={50}
        emptyTitle="no audit *logs*"
        emptyDescription="No recorded administrative or TORQ actions matching the filter criteria."
      />

      {/* Details JSON Modal */}
      <Dialog open={!!selectedDetails} onOpenChange={(open) => !open && setSelectedDetails(null)}>
        <DialogContent className="max-w-lg bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm font-bold text-fg">
              Audit #{selectedDetails?.id} · {selectedDetails?.action}
            </DialogTitle>
            <DialogDescription className="text-muted text-xs">
              Raw metadata payload stored in Postgres audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <pre className="p-3 rounded-lg bg-surface2 border border-border font-mono text-xs text-fg overflow-x-auto max-h-[350px] whitespace-pre-wrap">
              {JSON.stringify(selectedDetails?.details, null, 2) || '{}'}
            </pre>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedDetails(null)}
              className="rounded-full border-border bg-surface text-xs font-mono"
            >
              {en.common.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
