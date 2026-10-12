'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, ShieldCheck, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import { useMyContext } from '@/lib/providers';
import {
  collegesOverview,
  setCollegeActive,
  createCollege,
  setUserRole,
  toAppError,
  messageFor,
  t,
  en,
} from '@campuscycle/shared';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CollegeRow extends Record<string, unknown> {
  id: string;
  name: string;
  short_code: string;
  active: boolean;
  stands: number;
  bikes: number;
  riders: number;
  pending: number;
  admins: number;
  rides_7d: number;
}

interface UserSearchResult {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  college_id: string | null;
}

export default function CollegesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const ctx = useMyContext();
  const { setCollege } = useCollege();

  // Guard: non-super admins get notFound()
  if (ctx && ctx.profile.role !== 'super_admin' && !ctx.profile.is_owner) {
    notFound();
  }

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [appointDialogOpen, setAppointDialogOpen] = useState(false);
  const [targetCollege, setTargetCollege] = useState<{ id: string; name: string } | null>(null);

  // Add College Form State
  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [bikePrefix, setBikePrefix] = useState('');
  const [emailDomains, setEmailDomains] = useState('');
  const [timeZone, setTimeZone] = useState('Asia/Kolkata');
  const [centerLat, setCenterLat] = useState('26.5123');
  const [centerLng, setCenterLng] = useState('80.2329');
  const [creating, setCreating] = useState(false);

  // Appoint Admin Search State
  const [userSearch, setUserSearch] = useState('');
  const [appointingId, setAppointingId] = useState<string | null>(null);

  // Supported timezones
  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return ['Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London'];
    }
  }, []);

  // 1. Fetch colleges overview
  const { data: collegesData = [], isLoading } = useQuery({
    queryKey: ['colleges-overview'],
    queryFn: async () => {
      const data = await collegesOverview(supabase);
      return data as CollegeRow[];
    },
  });

  // 2. Search users query for appointing admin
  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ['users-appoint-search', userSearch],
    queryFn: async (): Promise<UserSearchResult[]> => {
      if (!userSearch.trim()) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, college_id')
        .ilike('email', `%${userSearch.trim()}%`)
        .limit(10);
      if (error) throw error;
      return (data ?? []) as UserSearchResult[];
    },
    enabled: appointDialogOpen && userSearch.trim().length > 1,
  });

  // Toggle active switch
  const handleToggleActive = async (row: CollegeRow, active: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await setCollegeActive(supabase, row.id, active);
      toast.success(`${row.name} is now ${active ? 'active' : 'inactive'}`);
      queryClient.invalidateQueries({ queryKey: ['colleges-overview'] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  // Submit Add College
  const handleCreateCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = shortCode.trim().toUpperCase();
    const cleanPrefix = (bikePrefix.trim() || cleanCode).toUpperCase();
    const domains = emailDomains
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    if (!name.trim()) {
      toast.error('College name is required');
      return;
    }
    if (!cleanCode || cleanCode.length < 2 || cleanCode.length > 6) {
      toast.error('Short code must be 2-6 uppercase letters');
      return;
    }

    setCreating(true);
    try {
      const result = await createCollege(supabase, {
        name: name.trim(),
        short_code: cleanCode,
        bike_prefix: cleanPrefix,
        email_domains: domains,
        time_zone: timeZone,
        center_lat: parseFloat(centerLat) || null,
        center_lng: parseFloat(centerLng) || null,
      });

      toast.success(en.a16.next_steps);
      setAddDialogOpen(false);
      setName('');
      setShortCode('');
      setBikePrefix('');
      setEmailDomains('');

      // Invalidate overview & switch scope
      await queryClient.invalidateQueries({ queryKey: ['colleges-overview'] });
      setCollege(result.id);
      router.push('/dashboard');
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setCreating(false);
    }
  };

  // Appoint Admin Action
  const handleAppointAdmin = async (userId: string, userLabel: string) => {
    if (!targetCollege) return;
    setAppointingId(userId);
    try {
      await setUserRole(supabase, userId, 'college_admin', targetCollege.id);
      toast.success(`Appointed ${userLabel} as admin for ${targetCollege.name}`);
      setAppointDialogOpen(false);
      setUserSearch('');
      queryClient.invalidateQueries({ queryKey: ['colleges-overview'] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setAppointingId(null);
    }
  };

  // Columns definition
  const columns: Column<CollegeRow>[] = [
    {
      key: 'name',
      header: 'College Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-surface2 border border-border flex items-center justify-center shrink-0">
            <Building2 className="size-3.5 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-fg text-sm">{row.name}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'short_code',
      header: 'Short Code',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-surface2 border border-border text-fg">
          {row.short_code}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Active',
      sortable: true,
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={row.active}
            onCheckedChange={(checked) =>
              handleToggleActive(row, checked, { stopPropagation: () => {} } as React.MouseEvent)
            }
            aria-label={`Toggle active for ${row.name}`}
          />
        </div>
      ),
    },
    {
      key: 'stands',
      header: 'Stands',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.stands}</span>,
    },
    {
      key: 'bikes',
      header: 'Bikes',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.bikes}</span>,
    },
    {
      key: 'riders',
      header: 'Riders',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.riders}</span>,
    },
    {
      key: 'pending',
      header: 'Pending',
      sortable: true,
      render: (row) => (
        <span className={`font-mono text-xs ${row.pending > 0 ? 'text-amber-500 font-bold' : 'text-muted'}`}>
          {row.pending}
        </span>
      ),
    },
    {
      key: 'admins',
      header: 'Admins',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.admins}</span>,
    },
    {
      key: 'rides_7d',
      header: 'Rides (7d)',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.rides_7d}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setTargetCollege({ id: row.id, name: row.name });
              setUserSearch('');
              setAppointDialogOpen(true);
            }}
            className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 gap-1.5 h-7"
          >
            <ShieldCheck className="size-3.5 text-primary" />
            <span>{en.a16.appoint}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      <PageHeader
        kicker="administration"
        title={t('a16.title')}
        lede="Manage colleges across the network, appoint admins, and inspect fleet scale."
        actions={
          <Button
            type="button"
            onClick={() => setAddDialogOpen(true)}
            className="rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 gap-1.5 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>{en.a16.add}</span>
          </Button>
        }
      />

      {/* Colleges Data Table */}
      <DataTable
        columns={columns}
        data={collegesData}
        loading={isLoading}
        onRowClick={(row) => {
          setCollege(row.id);
          router.push('/dashboard');
        }}
        emptyTitle="no colleges *yet*"
        emptyDescription="Create your first college to expand the cycle network."
      />

      {/* Add College Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md bg-surface border-border">
          <form onSubmit={handleCreateCollege}>
            <DialogHeader>
              <DialogTitle className="font-display lowercase text-lg font-bold">{en.a16.add}</DialogTitle>
              <DialogDescription className="text-muted text-xs">
                Set up a new campus with short codes, prefix, and operating boundaries.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="col-name" className="text-xs font-mono">
                  College Name
                </Label>
                <Input
                  id="col-name"
                  placeholder="Indian Institute of Technology Kanpur"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-surface2 border-border text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="col-code" className="text-xs font-mono">
                    {en.a16.short_code}
                  </Label>
                  <Input
                    id="col-code"
                    placeholder="IITK"
                    maxLength={6}
                    value={shortCode}
                    onChange={(e) => setShortCode(e.target.value.toUpperCase())}
                    required
                    className="bg-surface2 border-border text-xs font-mono uppercase"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="col-prefix" className="text-xs font-mono">
                    {en.a16.prefix}
                  </Label>
                  <Input
                    id="col-prefix"
                    placeholder="K"
                    maxLength={3}
                    value={bikePrefix}
                    onChange={(e) => setBikePrefix(e.target.value.toUpperCase())}
                    className="bg-surface2 border-border text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="col-domains" className="text-xs font-mono">
                  Email Domains (comma-separated)
                </Label>
                <Input
                  id="col-domains"
                  placeholder="iitk.ac.in, alumni.iitk.ac.in"
                  value={emailDomains}
                  onChange={(e) => setEmailDomains(e.target.value)}
                  className="bg-surface2 border-border text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="col-tz" className="text-xs font-mono">
                  {en.a16.tz}
                </Label>
                <select
                  id="col-tz"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-surface2 px-3 py-1 text-xs text-fg focus:outline-hidden"
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="col-lat" className="text-xs font-mono">
                    Center Latitude
                  </Label>
                  <Input
                    id="col-lat"
                    type="number"
                    step="any"
                    value={centerLat}
                    onChange={(e) => setCenterLat(e.target.value)}
                    className="bg-surface2 border-border text-xs font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="col-lng" className="text-xs font-mono">
                    Center Longitude
                  </Label>
                  <Input
                    id="col-lng"
                    type="number"
                    step="any"
                    value={centerLng}
                    onChange={(e) => setCenterLng(e.target.value)}
                    className="bg-surface2 border-border text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                disabled={creating}
                onClick={() => setAddDialogOpen(false)}
                className="rounded-full border-border bg-surface text-xs font-mono"
              >
                {en.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90"
              >
                {creating ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3 animate-spin" />
                    <span>Creating...</span>
                  </span>
                ) : (
                  en.a16.add
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Appoint Admin Dialog */}
      <Dialog open={appointDialogOpen} onOpenChange={setAppointDialogOpen}>
        <DialogContent className="max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-display lowercase text-lg font-bold">{en.a16.appoint}</DialogTitle>
            <DialogDescription className="text-muted text-xs">
              Search by email to appoint a college administrator for{' '}
              <strong className="text-fg">{targetCollege?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted" />
              <Input
                placeholder="Search user email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 bg-surface2 border-border text-xs"
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-border rounded-lg border border-border bg-surface2/50">
              {searchLoading ? (
                <div className="p-4 text-center text-xs font-mono text-muted flex items-center justify-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Searching profiles...</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 flex items-center justify-between gap-2 hover:bg-surface2 transition-colors"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-fg truncate">
                        {user.full_name || 'Unnamed Rider'}
                      </span>
                      <span className="text-[11px] font-mono text-muted truncate">{user.email}</span>
                      <span className="text-[10px] text-muted capitalize">Current: {user.role}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={appointingId === user.id}
                      onClick={() => handleAppointAdmin(user.id, user.full_name || user.email || 'User')}
                      className="rounded-full text-xs font-mono shrink-0 bg-primary text-on-primary hover:opacity-90 h-7"
                    >
                      {appointingId === user.id ? <Loader2 className="size-3 animate-spin" /> : 'Appoint'}
                    </Button>
                  </div>
                ))
              ) : userSearch.trim().length > 1 ? (
                <div className="p-4 text-center text-xs text-muted font-mono">No matching users found.</div>
              ) : (
                <div className="p-4 text-center text-xs text-muted font-mono">
                  Type at least 2 characters to search.
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAppointDialogOpen(false)}
              className="rounded-full border-border bg-surface text-xs font-mono"
            >
              {en.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
