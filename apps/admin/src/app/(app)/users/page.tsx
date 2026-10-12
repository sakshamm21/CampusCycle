'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Search, Download, Bike, AlertCircle, KeyRound } from 'lucide-react';

import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import { useMyContext } from '@/lib/providers';
import { exportCsv } from '@/lib/csv';
import { toAppError, en } from '@campuscycle/shared';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusPill } from '@/components/common/StatusPill';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface AdminUserRow extends Record<string, unknown> {
  id: string;
  college_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  roll_number: string | null;
  role: string | null;
  status: string | null;
  strikes: number | null;
  bike_code: string | null;
  current_ride_id: string | null;
  pass_label: string | null;
  total_rides: number | null;
  applied_at: string | null;
  password_reset_requested_at: string | null;
  is_owner: boolean | null;
  is_demo: boolean | null;
}

function UsersListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { collegeId } = useCollege();
  const ctx = useMyContext();
  const strikeLimit = ctx?.college?.strike_limit ?? 3;

  // URL state
  const qParam = searchParams.get('q') || '';
  const statusParam = searchParams.get('status') || 'all';
  const roleParam = searchParams.get('role') || 'all';
  const hasBikeParam = searchParams.get('has_bike') === '1';
  const hasStrikesParam = searchParams.get('has_strikes') === '1';
  const resetReqParam = searchParams.get('reset_req') === '1';

  const [searchTerm, setSearchTerm] = useState(qParam);

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === 'all' || value === '0') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.replace(`?${params.toString()}`);
  };

  // Q5: Admin users view with college scope
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', collegeId],
    queryFn: async () => {
      if (!collegeId) return [];
      const { data, error } = await supabase
        .from('admin_users_v')
        .select('*')
        .eq('college_id', collegeId)
        .order('created_at', { ascending: false });

      if (error) throw toAppError(error);
      return (data ?? []) as unknown as AdminUserRow[];
    },
    enabled: Boolean(collegeId),
  });

  // Client-side filtering for fast interactive search & toggles
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Text search: full_name, email, roll_number
      if (qParam.trim()) {
        const query = qParam.toLowerCase();
        const nameMatch = u.full_name?.toLowerCase().includes(query);
        const emailMatch = u.email?.toLowerCase().includes(query);
        const rollMatch = u.roll_number?.toLowerCase().includes(query);
        if (!nameMatch && !emailMatch && !rollMatch) return false;
      }

      // 2. Status filter
      if (statusParam !== 'all' && u.status !== statusParam) {
        return false;
      }

      // 3. Role filter
      if (roleParam !== 'all' && u.role !== roleParam) {
        return false;
      }

      // 4. Has bike filter
      if (hasBikeParam && !u.bike_code) {
        return false;
      }

      // 5. Has strikes filter
      if (hasStrikesParam && (!u.strikes || u.strikes <= 0)) {
        return false;
      }

      // 6. Reset requested filter
      if (resetReqParam && !u.password_reset_requested_at) {
        return false;
      }

      return true;
    });
  }, [users, qParam, statusParam, roleParam, hasBikeParam, hasStrikesParam, resetReqParam]);

  const handleExportCsv = () => {
    const filename = `users-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    exportCsv<AdminUserRow>(filename, filteredUsers, [
      { key: 'full_name', header: 'Full Name' },
      { key: 'email', header: 'Email' },
      { key: 'roll_number', header: 'Roll Number' },
      { key: 'role', header: 'Role' },
      { key: 'status', header: 'Status' },
      { key: 'pass_label', header: 'Pass Label' },
      { key: 'bike_code', header: 'Current Bike' },
      { key: 'strikes', header: 'Strikes' },
      { key: 'total_rides', header: 'Total Rides' },
      { key: 'applied_at', header: 'Applied At' },
    ]);
  };

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'full_name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-fg lowercase text-sm">{row.full_name || 'Anonymous'}</span>
          <span className="text-xs text-muted font-mono">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'roll_number',
      header: 'Roll',
      sortable: true,
      render: (row) => <span className="font-mono text-xs text-fg/80">{row.roll_number || '—'}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (row) => {
        const role = row.role || 'rider';
        const isOwner = row.is_owner;
        const isDemo = row.is_demo;

        return (
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold border',
                role === 'super_admin'
                  ? 'bg-primary/15 text-primary border-primary/25'
                  : role === 'college_admin'
                    ? 'bg-surface2 text-fg border-border'
                    : 'bg-surface2 text-muted border-border',
              )}
            >
              {role === 'super_admin' ? 'Super' : role === 'college_admin' ? 'Admin' : 'Rider'}
            </span>
            {isOwner && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-primary text-on-primary">
                OWNER
              </span>
            )}
            {isDemo && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-surface2 text-muted border border-border">
                DEMO
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <StatusPill status={row.status || 'pending'} />,
    },
    {
      key: 'pass_label',
      header: 'Pass',
      sortable: true,
      render: (row) => <span className="font-mono text-xs font-bold text-fg">{row.pass_label || '—'}</span>,
    },
    {
      key: 'bike_code',
      header: 'Bike',
      sortable: true,
      render: (row) =>
        row.bike_code ? (
          <span className="font-mono text-xs font-bold text-primary">{row.bike_code}</span>
        ) : (
          <span className="text-muted text-xs font-mono">—</span>
        ),
    },
    {
      key: 'strikes',
      header: 'Strikes',
      sortable: true,
      render: (row) => (
        <span
          className={cn('font-mono text-xs', (row.strikes ?? 0) > 0 ? 'text-bad font-bold' : 'text-muted')}
        >
          {row.strikes ?? 0}/{strikeLimit}
        </span>
      ),
    },
    {
      key: 'total_rides',
      header: 'Rides',
      sortable: true,
      render: (row) => <span className="font-mono text-xs text-fg">{row.total_rides ?? 0}</span>,
    },
    {
      key: 'applied_at',
      header: 'Applied',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-muted">
          {row.applied_at ? format(new Date(row.applied_at), 'd MMM yyyy') : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <PageHeader
        title={en.a04.title}
        lede="View registered riders, active passes and permission roles."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            disabled={filteredUsers.length === 0}
            className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 cursor-pointer transition-colors"
          >
            <Download className="size-3.5 mr-1.5" />
            <span>{en.a04.export}</span>
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateFilters({ q: searchTerm });
              }
            }}
            onBlur={() => updateFilters({ q: searchTerm })}
            placeholder={en.a04.search}
            className="pl-9 bg-surface border-border text-xs rounded-full h-10"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Select */}
          <Select value={statusParam} onValueChange={(val) => updateFilters({ status: val })}>
            <SelectTrigger className="h-10 text-xs font-mono bg-surface border-border rounded-full w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border text-xs font-mono">
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          {/* Role Select */}
          <Select value={roleParam} onValueChange={(val) => updateFilters({ role: val })}>
            <SelectTrigger className="h-10 text-xs font-mono bg-surface border-border rounded-full w-[130px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border text-xs font-mono">
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="rider">Rider</SelectItem>
              <SelectItem value="college_admin">College Admin</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick toggle chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => updateFilters({ has_bike: hasBikeParam ? null : '1' })}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-colors cursor-pointer',
            hasBikeParam
              ? 'bg-fg text-bg border-fg font-bold'
              : 'bg-surface border-border text-muted hover:text-fg hover:bg-surface2',
          )}
        >
          <Bike className="size-3.5" />
          <span>{en.a04.has_bike}</span>
        </button>

        <button
          type="button"
          onClick={() => updateFilters({ has_strikes: hasStrikesParam ? null : '1' })}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-colors cursor-pointer',
            hasStrikesParam
              ? 'bg-bad text-white border-bad font-bold'
              : 'bg-surface border-border text-muted hover:text-fg hover:bg-surface2',
          )}
        >
          <AlertCircle className="size-3.5" />
          <span>{en.a04.has_strikes}</span>
        </button>

        <button
          type="button"
          onClick={() => updateFilters({ reset_req: resetReqParam ? null : '1' })}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-colors cursor-pointer',
            resetReqParam
              ? 'bg-primary text-on-primary border-primary font-bold'
              : 'bg-surface border-border text-muted hover:text-fg hover:bg-surface2',
          )}
        >
          <KeyRound className="size-3.5" />
          <span>{en.a04.reset_req}</span>
        </button>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredUsers}
        loading={isLoading}
        onRowClick={(row) => router.push(`/users/${row.id}`)}
        emptyTitle="no riders *found*"
        emptyDescription="No users match the selected filters."
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="text-muted font-mono text-xs">Loading...</div>}>
      <UsersListContent />
    </Suspense>
  );
}
