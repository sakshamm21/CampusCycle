'use client';

import React, { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Kicker } from '@/components/common/Kicker';
import { Headline } from '@/components/common/Headline';
import { StatusPill } from '@/components/common/StatusPill';
import { StatTile } from '@/components/common/StatTile';
import { Sticker, type StickerColor } from '@/components/common/Sticker';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { PhotoThumb } from '@/components/common/PhotoThumb';
import { DataTable, type Column } from '@/components/common/DataTable';
import { RiderPassWeb, type PassFinish, type PassState } from '@/components/pass/RiderPassWeb';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface SampleRow extends Record<string, unknown> {
  id: string;
  code: string;
  stand: string;
  status: string;
  rides: number;
}

const SAMPLE_ROWS: SampleRow[] = [
  { id: '1', code: 'K-001', stand: 'Hall 1', status: 'available', rides: 142 },
  { id: '2', code: 'K-002', stand: 'Library', status: 'borrowed', rides: 88 },
  { id: '3', code: 'K-003', stand: 'LHC', status: 'maintenance', rides: 45 },
  { id: '4', code: 'K-004', stand: 'Hall 5', status: 'missing', rides: 12 },
  { id: '5', code: 'K-005', stand: 'Sports Complex', status: 'retired', rides: 230 },
];

const SAMPLE_COLUMNS: Column<SampleRow>[] = [
  { key: 'code', header: 'Bike Code', sortable: true, className: 'font-mono font-bold' },
  { key: 'stand', header: 'Current Stand', sortable: true },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusPill status={row.status} />,
  },
  {
    key: 'rides',
    header: 'Total Rides',
    sortable: true,
    render: (row) => <span className="font-mono">{row.rides}</span>,
  },
];

export default function DevComponentsPage() {
  const [queryClient] = useState(() => new QueryClient());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);

  const [passState, setPassState] = useState<PassState>('ready');
  const [passFinish, setPassFinish] = useState<PassFinish>('graphite');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="max-w-6xl mx-auto p-6 md:p-10 flex flex-col gap-12 bg-bg text-fg">
        {/* 1. Page Header */}
        <PageHeader
          kicker="Design system · Showcase"
          title="component *gallery*"
          lede="Visual catalog of all design system tokens and shared admin UI primitives."
          actions={
            <Button
              onClick={() => toast.success('Action clicked!')}
              className="rounded-full bg-primary text-on-primary font-mono text-xs cursor-pointer"
            >
              Trigger Toast
            </Button>
          }
        />

        {/* 2. Kickers & Headlines */}
        <section className="flex flex-col gap-4 p-6 rounded-card border border-border bg-surface">
          <Kicker text="Typography & Accents" live />
          <div className="flex flex-col gap-3">
            <Headline text="campus*cycle* display *xl*" size="xl" />
            <Headline text="heavy headline with *accent* word" size="l" />
            <Headline text="compact headline *medium*" size="m" />
          </div>
        </section>

        {/* 3. Status Pills */}
        <section className="flex flex-col gap-4 p-6 rounded-card border border-border bg-surface">
          <Kicker text="Status Pills" />
          <div className="flex flex-wrap gap-2.5">
            <StatusPill status="available" />
            <StatusPill status="borrowed" />
            <StatusPill status="maintenance" />
            <StatusPill status="missing" />
            <StatusPill status="retired" />
            <StatusPill status="ready" />
            <StatusPill status="riding" />
            <StatusPill status="overdue" />
            <StatusPill status="suspended" />
            <StatusPill status="pending" />
            <StatusPill status="resolved" />
          </div>
        </section>

        {/* 4. Stat Tiles */}
        <section className="flex flex-col gap-4">
          <Kicker text="Stat Tiles" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Available Bikes" value={24} sub="Ready across 10 stands" tone="ok" />
            <StatTile label="Active Rides" value={6} sub="2 finishing soon" tone="primary" />
            <StatTile label="Overdue Rides" value={2} sub="Needs follow up" tone="warn" />
            <StatTile label="Missing Bikes" value={1} sub="Reported today" tone="bad" />
          </div>
        </section>

        {/* 5. Stickers */}
        <section className="flex flex-col gap-4 p-6 rounded-card border border-border bg-surface">
          <Kicker text="Tilted Stickers" />
          <div className="flex flex-wrap items-center gap-6 py-2">
            {(['yellow', 'blue', 'coral', 'mint', 'ink', 'paper'] as StickerColor[]).map((c, i) => (
              <Sticker key={c} text={`${c} sticker`} color={c} rotate={(i % 2 === 0 ? -1 : 1) * (i + 2)} />
            ))}
          </div>
        </section>

        {/* 6. Rider Pass Web */}
        <section className="flex flex-col gap-6 p-6 rounded-card border border-border bg-surface">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Kicker text="Rider Pass (Interactive 3D)" live />
            <div className="flex flex-wrap gap-2">
              {(['graphite', 'chrome', 'holo'] as PassFinish[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={passFinish === f ? 'default' : 'outline'}
                  onClick={() => setPassFinish(f)}
                  className="rounded-full text-xs font-mono capitalize"
                >
                  {f}
                </Button>
              ))}
              {(['ready', 'riding', 'overdue', 'suspended'] as PassState[]).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={passState === s ? 'default' : 'outline'}
                  onClick={() => setPassState(s)}
                  className="rounded-full text-xs font-mono capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          <div className="max-w-md mx-auto w-full py-4">
            <RiderPassWeb
              holderName="Aanya Sharma"
              collegeName="IIT Kanpur"
              passLabel="IITK · 0421"
              finish={passFinish}
              state={passState}
              bikeCode="K-042"
              rides={18}
              minutes={240}
              faveStand="Library"
              strikes={0}
              tiltOnHover
              interactiveFlip
            />
          </div>
          <p className="text-center font-mono text-xs text-muted">
            Hover to tilt with pointer · Click card to flip and view live QR
          </p>
        </section>

        {/* 7. Dialogs */}
        <section className="flex flex-col gap-4 p-6 rounded-card border border-border bg-surface">
          <Kicker text="Modals & Dialogs" />
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setConfirmOpen(true)}
              variant="outline"
              className="rounded-full text-xs font-mono"
            >
              Open Confirm Dialog
            </Button>
            <Button
              onClick={() => setReasonOpen(true)}
              variant="outline"
              className="rounded-full text-xs font-mono"
            >
              Open Reason Dialog
            </Button>
          </div>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="retire *bike*"
            description="Are you sure you want to retire this bike from the active fleet?"
            targetName="Bike K-005"
            destructive
            onConfirm={() => {
              toast.success('Bike retired.');
            }}
          />

          <ReasonDialog
            open={reasonOpen}
            onOpenChange={setReasonOpen}
            title="suspend *rider*"
            description="Provide a justification for placing this rider pass on hold."
            targetName="Aanya Sharma (IITK · 0421)"
            destructive
            onConfirm={(reason) => {
              toast.success(`Rider suspended: ${reason}`);
            }}
          />
        </section>

        {/* 8. Photo Thumbnails */}
        <section className="flex flex-col gap-4 p-6 rounded-card border border-border bg-surface">
          <Kicker text="Photo Thumbnails & Lightbox" />
          <div className="flex items-center gap-3">
            <PhotoThumb bucket="id-cards" path={null} alt="Empty ID" size={56} />
            <PhotoThumb bucket="return-photos" path="demo/sample-return.jpg" alt="Sample Return" size={56} />
          </div>
        </section>

        {/* 9. Data Table */}
        <section className="flex flex-col gap-4">
          <Kicker text="Data Table" />
          <DataTable
            columns={SAMPLE_COLUMNS}
            data={SAMPLE_ROWS}
            onRowClick={(row) => toast.info(`Clicked row: ${row.code}`)}
          />
        </section>

        {/* 10. States (Empty & Error) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EmptyState
            stickerText="clean slate"
            stickerColor="mint"
            title="no open *issues*"
            description="Every bike report at your college is resolved. Great job keeping the fleet moving."
          />
          <ErrorState error={new Error('CC_NETWORK')} onRetry={() => toast.info('Retrying connection...')} />
        </section>
      </div>
    </QueryClientProvider>
  );
}

export const dynamic = 'force-dynamic';
