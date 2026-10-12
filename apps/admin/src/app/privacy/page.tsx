'use client';

import React from 'react';
import Link from 'next/link';
import { Bike, ArrowLeft, Shield, Clock, Lock, UserCheck, Eye, Trash2 } from 'lucide-react';
import { Headline } from '@/components/common/Headline';
import { Kicker } from '@/components/common/Kicker';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col justify-between selection:bg-primary selection:text-on-primary">
      {/* Top Navbar */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <Link
            href="/try"
            className="flex items-center gap-2 text-xs font-mono text-muted hover:text-fg transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Try CampusCycle</span>
          </Link>

          <Link href="/" className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-xs">
              <Bike className="size-4" />
            </div>
            <span className="font-heading font-black text-sm tracking-tight lowercase">campuscycle</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-16 flex flex-col gap-10 w-full">
        <div className="flex flex-col gap-3">
          <Kicker text="transparency & data rights" />
          <Headline text="privacy *policy*." size="xl" className="leading-tight" />
          <p className="text-xs font-mono text-muted">
            Last updated: October 2026 · Single policy for all participating campuses
          </p>
        </div>

        <div className="prose prose-invert max-w-none flex flex-col gap-8 text-sm leading-relaxed text-muted">
          <section className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-fg font-heading font-bold text-base lowercase">
              <UserCheck className="size-5 text-primary" />
              <span>1. what we collect</span>
            </div>
            <p className="text-xs leading-relaxed">
              When you register and use CampusCycle, we collect only the minimum required data to operate an
              accountable bicycle pool:
            </p>
            <ul className="list-disc list-inside text-xs space-y-1.5 pl-2">
              <li>
                <strong className="text-fg">Account details:</strong> Full name, university email address,
                phone number, and roll or employee ID number.
              </li>
              <li>
                <strong className="text-fg">Campus ID photo:</strong> Optional photo of your campus
                identification card uploaded for administrator verification.
              </li>
              <li>
                <strong className="text-fg">Stand geofence location:</strong> GPS coordinates are read
                strictly at the moment you scan to borrow or return, solely to ensure you are within a stand.{' '}
                <em>We do not track location in the background or during your ride.</em>
              </li>
              <li>
                <strong className="text-fg">Ride history:</strong> Timestamps of start and return, origin and
                destination stands, duration, and assigned bicycle code.
              </li>
              <li>
                <strong className="text-fg">Photos:</strong> Return parking confirmation photos and any
                maintenance report attachments.
              </li>
              <li>
                <strong className="text-fg">TORQ conversations:</strong> Transcripts of text and voice
                interactions with our AI assistant, with ephemeral memory.
              </li>
              <li>
                <strong className="text-fg">Push tokens:</strong> Device tokens strictly for ride reminders,
                overdue alerts, and approval notices.
              </li>
            </ul>
          </section>

          <section className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-fg font-heading font-bold text-base lowercase">
              <Shield className="size-5 text-primary" />
              <span>2. why we collect it</span>
            </div>
            <p className="text-xs leading-relaxed">We collect this data solely to:</p>
            <ul className="list-disc list-inside text-xs space-y-1 pl-2">
              <li>Verify campus eligibility and prevent unauthorized access to college-owned assets.</li>
              <li>Ensure bikes are borrowed and parked cleanly at authorized stands.</li>
              <li>Warn riders before exceeding college duration limits and enforce fair pool usage.</li>
              <li>Help fleet administrators inspect reports, balance bikes, and repair equipment.</li>
              <li>Enable TORQ to answer rider queries and verify return photos without human delays.</li>
            </ul>
          </section>

          <section className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-fg font-heading font-bold text-base lowercase">
              <Eye className="size-5 text-primary" />
              <span>3. who sees it</span>
            </div>
            <ul className="list-disc list-inside text-xs space-y-1.5 pl-2">
              <li>
                <strong className="text-fg">Your College Admins:</strong> Authorized admins for your college
                view rider lists, approvals, and issue reports. They cannot see data from other colleges.
              </li>
              <li>
                <strong className="text-fg">Super Admins:</strong> Multi-campus operators who inspect audit
                logs and server infrastructure.
              </li>
              <li>
                <strong className="text-fg">AI Providers:</strong> Requests to TORQ and visual checks use
                OpenRouter models. ID photos and return photos are sent strictly to providers with
                zero-retention / no-training terms.
              </li>
              <li>
                <strong className="text-fg">No Advertising:</strong> We never sell, rent, or share personal
                data with third-party advertisers.
              </li>
            </ul>
          </section>

          <section className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-fg font-heading font-bold text-base lowercase">
              <Clock className="size-5 text-primary" />
              <span>4. how long we keep it (retention schedule)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-surface2 border border-border flex flex-col gap-1">
                <span className="font-mono text-xs font-bold text-fg">Return Photos</span>
                <span className="text-[11px] text-muted">Automatically deleted 30 days after the ride.</span>
              </div>
              <div className="p-3 rounded-lg bg-surface2 border border-border flex flex-col gap-1">
                <span className="font-mono text-xs font-bold text-fg">TORQ Chat Photos</span>
                <span className="text-[11px] text-muted">Automatically deleted after 30 days.</span>
              </div>
              <div className="p-3 rounded-lg bg-surface2 border border-border flex flex-col gap-1">
                <span className="font-mono text-xs font-bold text-fg">Issue Report Photos</span>
                <span className="text-[11px] text-muted">
                  Automatically deleted 30 days after issue resolution.
                </span>
              </div>
              <div className="p-3 rounded-lg bg-surface2 border border-border flex flex-col gap-1">
                <span className="font-mono text-xs font-bold text-fg">Campus ID Photos</span>
                <span className="text-[11px] text-muted">
                  Stored in encrypted bucket until account deletion.
                </span>
              </div>
            </div>
            <p className="text-xs pt-1">
              Historical ride statistics remain for college administrative planning, but personal identifying
              details (name, email) are permanently removed upon account deletion.
            </p>
          </section>

          <section className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-fg font-heading font-bold text-base lowercase">
              <Lock className="size-5 text-primary" />
              <span>5. your choices & rights</span>
            </div>
            <ul className="list-disc list-inside text-xs space-y-1.5 pl-2">
              <li>
                <strong className="text-fg">Theme & Notifications:</strong> Manage notification types and UI
                theme in your Profile.
              </li>
              <li>
                <strong className="text-fg">Clear AI Memory:</strong> Tap &ldquo;Clear memory&rdquo; in the
                TORQ screen to wipe all past conversation context.
              </li>
              <li>
                <strong className="text-fg">Delete Account:</strong> Delete your account anytime in the app
                (Profile → Delete account) or via email. See our{' '}
                <Link href="/delete-account" className="text-primary underline">
                  Delete Account instructions
                </Link>
                .
              </li>
            </ul>
          </section>

          <section className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-fg font-heading font-bold text-base lowercase">
              <Trash2 className="size-5 text-primary" />
              <span>6. contact & data requests</span>
            </div>
            <p className="text-xs leading-relaxed">
              For any privacy inquiries or manual data deletion requests, contact the project owner at{' '}
              <strong className="font-mono text-fg">privacy@campuscycle.org</strong> or reach out via GitHub
              at{' '}
              <a
                href="https://github.com/sakshamm21/CampusCycle"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline font-mono"
              >
                github.com/sakshamm21/CampusCycle
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface/40 mt-16 py-8">
        <div className="max-w-4xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-muted">
          <p>CampusCycle · Open source campus mobility</p>
          <div className="flex items-center gap-6">
            <Link href="/try" className="hover:text-fg transition-colors">
              Try Demo
            </Link>
            <Link href="/delete-account" className="hover:text-fg transition-colors">
              Delete Account
            </Link>
            <Link href="/sign-in" className="hover:text-fg transition-colors">
              Admin Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
