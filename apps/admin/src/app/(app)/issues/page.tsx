'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Sparkles,
  Wrench,
  CheckCircle2,
  UserCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  ExternalLink,
  Check,
  Loader2,
  Layers,
  List as ListIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusPill } from '@/components/common/StatusPill';
import { ForceReturnDialog } from '@/components/common/ForceReturnDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import {
  updateIssue,
  setInsightStatus,
  setBikeMaintenance,
  signedPhotoUrl,
  toAppError,
  messageFor,
  en,
  type Database,
} from '@campuscycle/shared';

type IssueStatus = Database['public']['Enums']['issue_status'];
type IssueType = Database['public']['Enums']['issue_type'];

interface AdminIssueRow extends Record<string, unknown> {
  id: string;
  college_id: string;
  created_at: string;
  updated_at: string | null;
  status: IssueStatus;
  type: IssueType;
  urgency: number;
  note: string | null;
  photo_path: string | null;
  bike_id: string | null;
  bike_code: string | null;
  bike_status: string | null;
  stand_id: string | null;
  stand_name: string | null;
  reporter_id: string | null;
  reporter_name: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  group_id: string | null;
  ride_id: string | null;
  source: string | null;
  ai_suggested_type: IssueType | null;
  resolution_note: string | null;
  resolved_at: string | null;
}

interface IssueGroupInsight {
  id: string;
  college_id: string;
  kind: string;
  status: string;
  content: {
    title?: string;
    summary?: string;
    urgency?: number;
    bike_code?: string;
  };
  created_at: string;
}

function UrgencyBadge({ urgency }: { urgency: number }) {
  if (urgency >= 5) {
    return (
      <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase bg-bad/15 text-bad border border-bad/30">
        Urgency {urgency}
      </span>
    );
  }
  if (urgency >= 4) {
    return (
      <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase bg-warn/15 text-warn border border-warn/30">
        Urgency {urgency}
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase bg-surface2 text-muted border border-border">
      Urgency {urgency}
    </span>
  );
}

function IssuesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { college } = useCollege();

  const urlView = searchParams.get('view') === 'list' ? 'list' : 'grouped';
  const urlIssueId = searchParams.get('id');

  const [view, setView] = useState<'grouped' | 'list'>(urlView);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(urlIssueId);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('open_in_progress');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [bikeSearch, setBikeSearch] = useState('');

  // Dialog states
  const [resolveGroupDialog, setResolveGroupDialog] = useState<IssueGroupInsight | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [isResolvingGroup, setIsResolvingGroup] = useState(false);

  // Single issue resolution dialog
  const [resolveIssueOpen, setResolveIssueOpen] = useState(false);
  const [singleResolveNote, setSingleResolveNote] = useState('');
  const [isResolvingSingle, setIsResolvingSingle] = useState(false);

  // Force return dialog for ride_close_request
  const [forceReturnRideId, setForceReturnRideId] = useState<string | null>(null);
  const [forceReturnBikeCode, setForceReturnBikeCode] = useState<string>('bike');

  // Photo signed URL
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Current admin profile
  const { data: currentUserId } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
  });

  // 1. Fetch stands for force return dialog
  const { data: stands = [] } = useQuery({
    queryKey: ['admin-stands-list', college?.id],
    queryFn: async () => {
      if (!college?.id) return [];
      const { data, error } = await supabase
        .from('stands')
        .select('id, name')
        .eq('college_id', college.id)
        .order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: !!college?.id,
  });

  // 2. Fetch issues from admin_issues_v
  const { data: allIssues = [], isLoading: issuesLoading } = useQuery({
    queryKey: ['admin-issues', college?.id],
    queryFn: async (): Promise<AdminIssueRow[]> => {
      if (!college?.id) return [];
      const { data, error } = await supabase
        .from('admin_issues_v')
        .select('*')
        .eq('college_id', college.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdminIssueRow[];
    },
    enabled: !!college?.id,
  });

  // 3. Fetch AI Insights Groups (kind: issue_group, status: active)
  const { data: groups = [] } = useQuery({
    queryKey: ['admin-issue-groups', college?.id],
    queryFn: async (): Promise<IssueGroupInsight[]> => {
      if (!college?.id) return [];
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('college_id', college.id)
        .eq('kind', 'issue_group')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as IssueGroupInsight[];
    },
    enabled: !!college?.id,
  });

  // Keep URL updated with view
  const switchView = (newView: 'grouped' | 'list') => {
    setView(newView);
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', newView);
    router.replace(`/issues?${params.toString()}`);
  };

  // Sync selected issue from URL param
  useEffect(() => {
    if (urlIssueId) {
      setSelectedIssueId(urlIssueId);
    }
  }, [urlIssueId]);

  const openIssueDetail = (id: string) => {
    setSelectedIssueId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('id', id);
    router.replace(`/issues?${params.toString()}`);
  };

  const closeIssueDetail = () => {
    setSelectedIssueId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('id');
    router.replace(`/issues?${params.toString()}`);
  };

  // Filter issues
  const filteredIssues = useMemo(() => {
    return allIssues.filter((issue) => {
      // Status filter
      if (statusFilter === 'open_in_progress') {
        if (issue.status !== 'open' && issue.status !== 'in_progress') return false;
      } else if (statusFilter !== 'all') {
        if (issue.status !== statusFilter) return false;
      }

      // Type filter
      if (typeFilter !== 'all' && issue.type !== typeFilter) return false;

      // Urgency filter
      if (urgencyFilter !== 'all') {
        const minUrg = parseInt(urgencyFilter, 10);
        if (issue.urgency < minUrg) return false;
      }

      // Assigned to me
      if (assignedToMe && issue.assigned_to !== currentUserId) return false;

      // Bike search
      if (bikeSearch.trim()) {
        const query = bikeSearch.trim().toLowerCase();
        if (!issue.bike_code?.toLowerCase().includes(query)) return false;
      }

      return true;
    });
  }, [allIssues, statusFilter, typeFilter, urgencyFilter, assignedToMe, currentUserId, bikeSearch]);

  // Selected issue record for Sheet
  const activeIssue = useMemo(() => {
    if (!selectedIssueId) return null;
    return allIssues.find((i) => i.id === selectedIssueId) ?? null;
  }, [allIssues, selectedIssueId]);

  // Load signed photo URL for active issue
  useEffect(() => {
    let cancelled = false;
    if (activeIssue?.photo_path) {
      signedPhotoUrl(supabase, 'issue-photos', activeIssue.photo_path)
        .then((url) => {
          if (!cancelled) setPhotoUrl(url);
        })
        .catch(() => {
          if (!cancelled) setPhotoUrl(null);
        });
    } else {
      setPhotoUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [activeIssue]);

  // Mapping issues by group_id
  const issuesByGroupId = useMemo(() => {
    const map = new Map<string, AdminIssueRow[]>();
    for (const issue of filteredIssues) {
      if (issue.group_id) {
        const existing = map.get(issue.group_id) ?? [];
        existing.push(issue);
        map.set(issue.group_id, existing);
      }
    }
    return map;
  }, [filteredIssues]);

  // Ungrouped issues
  const activeGroupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);

  const ungroupedIssues = useMemo(() => {
    return filteredIssues
      .filter((i) => !i.group_id || !activeGroupIds.has(i.group_id))
      .sort((a, b) => {
        if (b.urgency !== a.urgency) return b.urgency - a.urgency;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [filteredIssues, activeGroupIds]);

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Actions on issues
  const handleAssignToMe = async (issueId: string) => {
    try {
      await updateIssue(supabase, issueId, {
        assign_to_me: true,
        status: 'in_progress',
      });
      toast.success('Assigned to you.');
      await queryClient.invalidateQueries({ queryKey: ['admin-issues', college?.id] });
    } catch (err) {
      toast.error(messageFor(toAppError(err).code));
    }
  };

  const handleUpdateStatus = async (issueId: string, status: IssueStatus) => {
    if (status === 'resolved') {
      setResolveIssueOpen(true);
      return;
    }
    try {
      await updateIssue(supabase, issueId, { status });
      toast.success(`Status updated to ${status}.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-issues', college?.id] });
    } catch (err) {
      toast.error(messageFor(toAppError(err).code));
    }
  };

  const handleResolveSingleIssue = async () => {
    if (!activeIssue || singleResolveNote.trim().length < 3) {
      toast.error('Please enter a resolution note (at least 3 characters).');
      return;
    }
    setIsResolvingSingle(true);
    try {
      await updateIssue(supabase, activeIssue.id, {
        status: 'resolved',
        note: singleResolveNote.trim(),
      });
      toast.success('Issue resolved.');
      setResolveIssueOpen(false);
      setSingleResolveNote('');
      closeIssueDetail();
      await queryClient.invalidateQueries({ queryKey: ['admin-issues', college?.id] });
    } catch (err) {
      toast.error(messageFor(toAppError(err).code));
    } finally {
      setIsResolvingSingle(false);
    }
  };

  const handleToggleMaintenance = async (bikeId: string, on: boolean) => {
    try {
      await setBikeMaintenance(supabase, bikeId, on, 'Reported issue maintenance update');
      toast.success(on ? 'Bike placed in maintenance.' : 'Bike returned to service.');
      await queryClient.invalidateQueries({ queryKey: ['admin-issues', college?.id] });
    } catch (err) {
      toast.error(messageFor(toAppError(err).code));
    }
  };

  const handleDismissGroup = async (groupId: string) => {
    try {
      await setInsightStatus(supabase, groupId, 'dismissed');
      toast.success('Group dismissed.');
      await queryClient.invalidateQueries({ queryKey: ['admin-issue-groups', college?.id] });
    } catch (err) {
      toast.error(messageFor(toAppError(err).code));
    }
  };

  const handleResolveAllInGroup = async () => {
    if (!resolveGroupDialog || resolveNote.trim().length < 3) {
      toast.error('Please enter a resolution note (at least 3 characters).');
      return;
    }
    const groupIssues = issuesByGroupId.get(resolveGroupDialog.id) ?? [];
    setIsResolvingGroup(true);
    try {
      for (const item of groupIssues) {
        await updateIssue(supabase, item.id, {
          status: 'resolved',
          note: resolveNote.trim(),
        });
      }
      await setInsightStatus(supabase, resolveGroupDialog.id, 'dismissed');
      toast.success(`Resolved all ${groupIssues.length} issues in group.`);
      setResolveGroupDialog(null);
      setResolveNote('');
      await queryClient.invalidateQueries({ queryKey: ['admin-issues', college?.id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-issue-groups', college?.id] });
    } catch (err) {
      toast.error(messageFor(toAppError(err).code));
    } finally {
      setIsResolvingGroup(false);
    }
  };

  // Table columns for list view
  const columns: Column<AdminIssueRow>[] = [
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (row) => (
        <span className="text-xs font-mono text-muted whitespace-nowrap">
          {format(new Date(row.created_at), 'MMM d, HH:mm')}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (row) => {
        const isSuggested = row.ai_suggested_type === row.type;
        return (
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-surface2 text-fg border border-border capitalize">
              {row.type.replace(/_/g, ' ')}
            </span>
            {isSuggested && <span title={en.a11.suggested} className="size-2 rounded-full bg-primary" />}
          </div>
        );
      },
    },
    {
      key: 'bike_code',
      header: 'Bike',
      sortable: true,
      render: (row) =>
        row.bike_code ? (
          <span className="font-mono font-bold text-xs text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
            {row.bike_code}
          </span>
        ) : (
          <span className="text-muted text-xs font-mono">—</span>
        ),
    },
    {
      key: 'stand_name',
      header: 'Stand',
      sortable: true,
      render: (row) => (
        <span className="text-xs font-mono text-fg truncate max-w-[140px] block">
          {row.stand_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'reporter_name',
      header: 'Reporter',
      sortable: true,
      render: (row) => <span className="text-xs font-mono text-fg">{row.reporter_name ?? 'Anonymous'}</span>,
    },
    {
      key: 'urgency',
      header: 'Urgency',
      sortable: true,
      render: (row) => <UrgencyBadge urgency={row.urgency} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <StatusPill
          status={row.status === 'open' ? 'warn' : row.status === 'in_progress' ? 'subtle' : 'ok'}
          label={row.status.replace(/_/g, ' ')}
        />
      ),
    },
    {
      key: 'assignee_name',
      header: 'Assignee',
      sortable: true,
      render: (row) => (
        <span className="text-xs font-mono text-muted">{row.assignee_name ?? 'Unassigned'}</span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (row) => (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-surface border border-border text-muted">
          {row.source ?? 'APP'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={college?.short_code}
        title={en.a11.title}
        lede="Triage rider reports, TORQ grouped issues, maintenance requests, and ride closure requests."
        actions={
          <div className="flex items-center gap-1 p-1 bg-surface border border-border rounded-full shadow-2xs">
            <button
              onClick={() => switchView('grouped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                view === 'grouped'
                  ? 'bg-primary text-on-primary font-bold shadow-xs'
                  : 'text-muted hover:text-fg'
              }`}
            >
              <Layers className="size-3.5" />
              {en.a11.grouped}
            </button>
            <button
              onClick={() => switchView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                view === 'list'
                  ? 'bg-primary text-on-primary font-bold shadow-xs'
                  : 'text-muted hover:text-fg'
              }`}
            >
              <ListIcon className="size-3.5" />
              {en.a11.list}
            </button>
          </div>
        }
      />

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-surface border border-border shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? 'open_in_progress')}>
            <SelectTrigger className="w-[180px] h-9 text-xs font-mono bg-surface2 border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border">
              <SelectItem value="open_in_progress" className="text-xs font-mono">
                Open + In progress
              </SelectItem>
              <SelectItem value="open" className="text-xs font-mono">
                Open only
              </SelectItem>
              <SelectItem value="in_progress" className="text-xs font-mono">
                In progress
              </SelectItem>
              <SelectItem value="resolved" className="text-xs font-mono">
                Resolved
              </SelectItem>
              <SelectItem value="all" className="text-xs font-mono">
                All statuses
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Type filter */}
          <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val ?? 'all')}>
            <SelectTrigger className="w-[160px] h-9 text-xs font-mono bg-surface2 border-border">
              <SelectValue placeholder="Issue type" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border">
              <SelectItem value="all" className="text-xs font-mono">
                All types
              </SelectItem>
              <SelectItem value="brakes" className="text-xs font-mono">
                Brakes
              </SelectItem>
              <SelectItem value="flat_tyre" className="text-xs font-mono">
                Flat tyre
              </SelectItem>
              <SelectItem value="chain" className="text-xs font-mono">
                Chain
              </SelectItem>
              <SelectItem value="lock" className="text-xs font-mono">
                Lock
              </SelectItem>
              <SelectItem value="lights" className="text-xs font-mono">
                Lights
              </SelectItem>
              <SelectItem value="damaged_qr" className="text-xs font-mono">
                Damaged QR
              </SelectItem>
              <SelectItem value="ride_close_request" className="text-xs font-mono">
                Ride close request
              </SelectItem>
              <SelectItem value="other" className="text-xs font-mono">
                Other
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Urgency filter */}
          <Select value={urgencyFilter} onValueChange={(val) => setUrgencyFilter(val ?? 'all')}>
            <SelectTrigger className="w-[140px] h-9 text-xs font-mono bg-surface2 border-border">
              <SelectValue placeholder="Urgency" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border">
              <SelectItem value="all" className="text-xs font-mono">
                All urgencies
              </SelectItem>
              <SelectItem value="5" className="text-xs font-mono">
                Urgency 5 only
              </SelectItem>
              <SelectItem value="4" className="text-xs font-mono">
                Urgency ≥ 4
              </SelectItem>
              <SelectItem value="3" className="text-xs font-mono">
                Urgency ≥ 3
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Assigned to me toggle */}
          <label className="flex items-center gap-2 text-xs font-mono text-muted cursor-pointer hover:text-fg">
            <input
              type="checkbox"
              checked={assignedToMe}
              onChange={(e) => setAssignedToMe(e.target.checked)}
              className="rounded border-border accent-primary"
            />
            <span>Assigned to me</span>
          </label>
        </div>

        {/* Bike code search */}
        <div className="relative w-full sm:w-[200px]">
          <Search className="size-3.5 absolute left-3 top-2.5 text-muted" />
          <Input
            placeholder="Search bike code..."
            value={bikeSearch}
            onChange={(e) => setBikeSearch(e.target.value)}
            className="pl-8 h-9 text-xs font-mono bg-surface2 border-border"
          />
        </div>
      </div>

      {/* Main Content: Grouped vs List */}
      {issuesLoading ? (
        <div className="p-16 text-center font-mono text-xs text-muted flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin text-primary" />
          Loading issues...
        </div>
      ) : filteredIssues.length === 0 && groups.length === 0 ? (
        <div className="p-16 text-center rounded-2xl border border-dashed border-border bg-surface">
          <CheckCircle2 className="size-10 text-ok mx-auto mb-3 opacity-80" />
          <h3 className="font-display font-bold text-base text-fg mb-1">{en.a11.empty}</h3>
          <p className="text-xs font-mono text-muted">
            All bikes and stands are operating without reported defects.
          </p>
        </div>
      ) : view === 'grouped' ? (
        /* Grouped View */
        <div className="space-y-6">
          {/* TORQ AI Issue Groups */}
          {groups.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-muted">
                <Sparkles className="size-3.5 text-primary" />
                <span className="font-bold uppercase tracking-wider text-fg">
                  TORQ Issue Groups ({groups.length})
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {groups.map((group) => {
                  const groupIssues = issuesByGroupId.get(group.id) ?? [];
                  const urgency = group.content.urgency ?? 5;
                  const isExpanded = expandedGroupIds.has(group.id);
                  const firstBikeId = groupIssues[0]?.bike_id;

                  return (
                    <div
                      key={group.id}
                      className="p-5 rounded-2xl bg-surface border-2 border-primary/20 shadow-xs hover:border-primary/40 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="font-display font-bold text-base text-fg">
                              {group.content.title ?? 'Grouped Issue'}
                            </h3>
                            <UrgencyBadge urgency={urgency} />
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                              {groupIssues.length} reports
                            </span>
                            {group.content.bike_code && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-surface2 text-fg border border-border">
                                {group.content.bike_code}
                              </span>
                            )}
                          </div>
                          {group.content.summary && (
                            <p className="text-xs font-mono text-muted max-w-2xl leading-relaxed">
                              {group.content.summary}
                            </p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() => setResolveGroupDialog(group)}
                            className="h-8 px-3 rounded-full font-mono text-xs font-bold bg-primary text-on-primary hover:bg-primary/90 cursor-pointer shadow-xs"
                          >
                            <Check className="size-3.5 mr-1" />
                            {en.a11.resolve_all}
                          </Button>

                          {firstBikeId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleMaintenance(firstBikeId, true)}
                              className="h-8 px-3 rounded-full font-mono text-xs border-border bg-surface hover:bg-surface2 cursor-pointer"
                            >
                              <Wrench className="size-3.5 mr-1 text-warn" />
                              Bike to maintenance
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDismissGroup(group.id)}
                            className="h-8 px-3 rounded-full font-mono text-xs text-muted hover:text-bad cursor-pointer"
                          >
                            {en.a11.dismiss_group}
                          </Button>

                          <button
                            onClick={() => toggleGroupExpanded(group.id)}
                            className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface2 cursor-pointer transition-colors"
                            aria-label="Toggle group reports"
                          >
                            {isExpanded ? (
                              <ChevronUp className="size-4" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Expanded list of issues in group */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border space-y-2">
                          <span className="text-[11px] font-mono text-muted block mb-2">
                            Included reports:
                          </span>
                          {groupIssues.map((issue) => (
                            <div
                              key={issue.id}
                              onClick={() => openIssueDetail(issue.id)}
                              className="p-3 rounded-xl bg-surface2/50 border border-border hover:bg-surface2 transition-colors cursor-pointer flex items-center justify-between gap-3"
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-fg capitalize">
                                    {issue.type.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-xs font-mono text-muted">·</span>
                                  <span className="text-xs font-mono text-muted">
                                    {issue.reporter_name ?? 'Anonymous'}
                                  </span>
                                </div>
                                <p className="text-xs font-mono text-muted truncate">
                                  {issue.note ?? 'No note provided'}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <StatusPill
                                  status={issue.status === 'open' ? 'warn' : 'ok'}
                                  label={issue.status}
                                />
                                <ChevronRight className="size-4 text-muted" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ungrouped Issues */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-muted">
              <span className="font-bold uppercase tracking-wider text-fg">
                Ungrouped Reports ({ungroupedIssues.length})
              </span>
              <span>Sorted by urgency & date</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ungroupedIssues.map((issue) => (
                <div
                  key={issue.id}
                  onClick={() => openIssueDetail(issue.id)}
                  className="p-4 rounded-xl bg-surface border border-border hover:border-primary/40 transition-all cursor-pointer space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-fg capitalize truncate">
                          {issue.type.replace(/_/g, ' ')}
                        </span>
                        {issue.bike_code && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                            {issue.bike_code}
                          </span>
                        )}
                      </div>
                      <UrgencyBadge urgency={issue.urgency} />
                    </div>

                    <p className="text-xs font-mono text-muted line-clamp-2">
                      {issue.note ?? 'No description'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted">
                    <span>{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</span>
                    <StatusPill
                      status={
                        issue.status === 'open' ? 'warn' : issue.status === 'in_progress' ? 'subtle' : 'ok'
                      }
                      label={issue.status.replace(/_/g, ' ')}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <DataTable
            data={filteredIssues}
            columns={columns}
            onRowClick={(item) => openIssueDetail(item.id)}
          />
        </div>
      )}

      {/* Issue Detail Sheet */}
      <Sheet open={!!activeIssue} onOpenChange={(open) => !open && closeIssueDetail()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg bg-surface border-l border-border p-0 flex flex-col"
        >
          {activeIssue && (
            <>
              <SheetHeader className="p-6 border-b border-border bg-surface2/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="size-4 text-primary" />
                    <SheetTitle className="font-display font-bold text-base text-fg capitalize">
                      {activeIssue.type.replace(/_/g, ' ')}
                    </SheetTitle>
                  </div>
                  <UrgencyBadge urgency={activeIssue.urgency} />
                </div>
                <SheetDescription className="text-xs font-mono text-muted">
                  Reported {format(new Date(activeIssue.created_at), 'PPP p')}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Photo Thumbnail */}
                {photoUrl && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono text-muted">Photo</Label>
                    <div className="rounded-xl overflow-hidden border border-border bg-black/40 max-h-56 flex items-center justify-center">
                      <img
                        src={photoUrl}
                        alt="Issue photo"
                        className="w-full h-full object-contain max-h-56"
                      />
                    </div>
                  </div>
                )}

                {/* Reporter note */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted">Reporter Note</Label>
                  <div className="p-3 rounded-xl bg-surface2 text-xs font-mono text-fg border border-border leading-relaxed">
                    {activeIssue.note ?? 'No note provided.'}
                  </div>
                </div>

                {/* Bike & Ride metadata */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-surface2/50 border border-border text-xs font-mono">
                  <div>
                    <span className="text-muted block text-[11px]">Bike</span>
                    {activeIssue.bike_code ? (
                      <Link
                        href={`/bikes?search=${activeIssue.bike_code}`}
                        className="font-bold text-primary hover:underline flex items-center gap-1 mt-0.5"
                      >
                        {activeIssue.bike_code}
                        <ExternalLink className="size-3" />
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </div>

                  <div>
                    <span className="text-muted block text-[11px]">Stand</span>
                    <span className="font-medium text-fg block mt-0.5">{activeIssue.stand_name ?? '—'}</span>
                  </div>

                  <div>
                    <span className="text-muted block text-[11px]">Reporter</span>
                    <span className="font-medium text-fg block mt-0.5">
                      {activeIssue.reporter_name ?? 'Anonymous'}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted block text-[11px]">Ride</span>
                    {activeIssue.ride_id ? (
                      <Link
                        href={`/rides?search=${activeIssue.ride_id}`}
                        className="font-bold text-primary hover:underline flex items-center gap-1 mt-0.5"
                      >
                        Ride detail
                        <ExternalLink className="size-3" />
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </div>
                </div>

                {/* Special ride_close_request action */}
                {activeIssue.type === 'ride_close_request' && activeIssue.ride_id && (
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="size-4 text-primary" />
                      <span className="font-mono font-bold text-xs text-primary">
                        Rider requested ride closure
                      </span>
                    </div>
                    <p className="text-xs font-mono text-muted">
                      Rider was unable to return the bike normally. Force-return to end the ride.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => {
                        setForceReturnRideId(activeIssue.ride_id);
                        setForceReturnBikeCode(activeIssue.bike_code ?? 'bike');
                      }}
                      className="w-full font-mono text-xs font-bold bg-primary text-on-primary hover:bg-primary/90"
                    >
                      {en.a11.close_ride}
                    </Button>
                  </div>
                )}

                {/* Actions: Assign to me, status select, maintenance switch */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted">Assignee</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAssignToMe(activeIssue.id)}
                      disabled={activeIssue.assigned_to === currentUserId}
                      className="h-8 font-mono text-xs border-border bg-surface"
                    >
                      <UserCheck className="size-3.5 mr-1" />
                      {activeIssue.assigned_to === currentUserId ? 'Assigned to you' : en.a11.assign_me}
                    </Button>
                  </div>

                  {activeIssue.bike_id && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface2 border border-border">
                      <div className="space-y-0.5">
                        <span className="text-xs font-mono font-medium text-fg">Bike to maintenance</span>
                        <p className="text-[11px] font-mono text-muted">
                          Take bike out of circulation for repair
                        </p>
                      </div>
                      <Switch
                        checked={activeIssue.bike_status === 'maintenance'}
                        onCheckedChange={(checked) => handleToggleMaintenance(activeIssue.bike_id!, checked)}
                      />
                    </div>
                  )}

                  {/* Status selection */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono text-muted">Issue Status</Label>
                    <Select
                      value={activeIssue.status}
                      onValueChange={(val) => {
                        if (val) handleUpdateStatus(activeIssue.id, val as IssueStatus);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs font-mono bg-surface2 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-surface border-border">
                        <SelectItem value="open" className="text-xs font-mono">
                          Open
                        </SelectItem>
                        <SelectItem value="in_progress" className="text-xs font-mono">
                          In progress
                        </SelectItem>
                        <SelectItem value="resolved" className="text-xs font-mono">
                          Resolved
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Resolution note if already resolved */}
                {activeIssue.resolution_note && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-ok/10 border border-ok/20">
                    <span className="text-xs font-mono font-bold text-ok block">Resolution Note:</span>
                    <p className="text-xs font-mono text-fg">{activeIssue.resolution_note}</p>
                  </div>
                )}
              </div>

              {/* Sheet Footer */}
              <div className="p-4 border-t border-border flex items-center justify-between bg-surface2/30">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeIssueDetail}
                  className="font-mono text-xs text-muted hover:text-fg"
                >
                  Close
                </Button>

                {activeIssue.status !== 'resolved' && (
                  <Button
                    size="sm"
                    onClick={() => setResolveIssueOpen(true)}
                    className="font-mono text-xs font-bold bg-ok text-white hover:bg-ok/90"
                  >
                    <Check className="size-3.5 mr-1" />
                    {en.a11.resolve}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Resolve Single Issue Dialog */}
      <Dialog open={resolveIssueOpen} onOpenChange={setResolveIssueOpen}>
        <DialogContent className="max-w-md bg-surface border-border text-fg">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-base">Resolve Issue</DialogTitle>
            <DialogDescription className="text-xs font-mono text-muted">
              {en.a11.resolution}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Textarea
              placeholder="e.g. Replaced front brake pads and tightened brake cables."
              value={singleResolveNote}
              onChange={(e) => setSingleResolveNote(e.target.value)}
              rows={4}
              className="text-xs font-mono bg-surface2 border-border"
            />
          </div>

          <DialogFooter className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResolveIssueOpen(false)}
              className="text-xs font-mono text-muted"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleResolveSingleIssue}
              disabled={isResolvingSingle || singleResolveNote.trim().length < 3}
              className="font-mono text-xs font-bold bg-primary text-on-primary hover:bg-primary/90"
            >
              {isResolvingSingle ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <Check className="size-3.5 mr-1.5" />
              )}
              {en.a11.resolve}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve All In Group Dialog */}
      <Dialog open={!!resolveGroupDialog} onOpenChange={(open) => !open && setResolveGroupDialog(null)}>
        <DialogContent className="max-w-md bg-surface border-border text-fg">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-base">{en.a11.resolve_all}</DialogTitle>
            <DialogDescription className="text-xs font-mono text-muted">
              Resolve all reports in &ldquo;{resolveGroupDialog?.content.title}&rdquo;. Each reporter will be
              notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs font-mono text-fg">{en.a11.resolution}</Label>
            <Textarea
              placeholder="e.g. Inspected bike, adjusted brake caliper and tension wire."
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              rows={4}
              className="text-xs font-mono bg-surface2 border-border"
            />
          </div>

          <DialogFooter className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResolveGroupDialog(null)}
              className="text-xs font-mono text-muted"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleResolveAllInGroup}
              disabled={isResolvingGroup || resolveNote.trim().length < 3}
              className="font-mono text-xs font-bold bg-primary text-on-primary hover:bg-primary/90"
            >
              {isResolvingGroup ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <Check className="size-3.5 mr-1.5" />
              )}
              {en.a11.resolve_all}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reusable ForceReturnDialog for ride_close_request */}
      <ForceReturnDialog
        open={!!forceReturnRideId}
        onOpenChange={(open) => !open && setForceReturnRideId(null)}
        rideId={forceReturnRideId ?? undefined}
        bikeCode={forceReturnBikeCode}
        stands={stands}
        onSuccess={() => {
          setForceReturnRideId(null);
          queryClient.invalidateQueries({ queryKey: ['admin-issues', college?.id] });
          toast.success('Ride closed.');
        }}
      />
    </div>
  );
}

export default function IssuesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 font-mono text-xs text-muted flex items-center gap-2">
          <Loader2 className="size-4 animate-spin text-primary" />
          Loading issues...
        </div>
      }
    >
      <IssuesContent />
    </Suspense>
  );
}
