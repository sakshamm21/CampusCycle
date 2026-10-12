'use client';

import React from 'react';
import Link from 'next/link';
import { Bike, ArrowLeft, Smartphone, Mail, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Headline } from '@/components/common/Headline';
import { Kicker } from '@/components/common/Kicker';

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col justify-between selection:bg-primary selection:text-on-primary">
      {/* Top Navbar */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
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
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-10 md:py-16 flex flex-col gap-10 w-full">
        <div className="flex flex-col gap-3">
          <Kicker text="account & data deletion" />
          <Headline text="delete your *account*." size="xl" className="leading-tight" />
          <p className="text-xs font-mono text-muted">
            Google Play & Apple App Store compliance · How to permanently remove your data
          </p>
        </div>

        <div className="flex flex-col gap-6 text-sm leading-relaxed">
          {/* Method 1: In the App */}
          <section className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-surface2 border border-border flex items-center justify-center text-primary shrink-0">
                <Smartphone className="size-5" />
              </div>
              <div className="flex flex-col">
                <h2 className="font-heading font-bold text-base text-fg lowercase">
                  1. delete directly inside the mobile app
                </h2>
                <span className="text-xs text-muted">Recommended · Instant automated processing</span>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              If you have the CampusCycle rider application installed on your Android or iOS device:
            </p>

            <ol className="list-decimal list-inside text-xs space-y-2 pl-2 text-muted">
              <li>Open the CampusCycle app and ensure you are signed in.</li>
              <li>
                Navigate to the <strong className="text-fg">Profile</strong> tab in the bottom dock.
              </li>
              <li>
                Scroll down to the <strong className="text-fg">Account</strong> section and tap{' '}
                <strong className="text-fg">Delete account</strong>.
              </li>
              <li>
                Confirm your deletion. Your active pass will be revoked and all profile credentials will be
                permanently erased.
              </li>
            </ol>
          </section>

          {/* Method 2: Without the App */}
          <section className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-surface2 border border-border flex items-center justify-center text-primary shrink-0">
                <Mail className="size-5" />
              </div>
              <div className="flex flex-col">
                <h2 className="font-heading font-bold text-base text-fg lowercase">
                  2. delete without the app (email request)
                </h2>
                <span className="text-xs text-muted">For users who uninstalled the app or lost access</span>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Email the owner from your account&apos;s registered email address and we delete it within 7
              days.
            </p>

            <div className="p-4 rounded-xl bg-surface2 border border-border flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-muted">Recipient:</span>
                <strong className="text-fg">privacy@campuscycle.org</strong>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-muted">Subject:</span>
                <span className="text-fg">Delete Account Request</span>
              </div>
              <div className="text-[11px] text-muted font-mono pt-1">
                Please send the email directly from the university email address associated with your
                CampusCycle account so we can verify account ownership.
              </div>
            </div>
          </section>

          {/* What happens to your data */}
          <section className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-fg font-heading font-bold text-sm lowercase">
              <ShieldAlert className="size-4 text-amber-500" />
              <span>what happens when your account is deleted</span>
            </div>

            <ul className="text-xs space-y-1.5 text-muted pl-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-good shrink-0 mt-0.5" />
                <span>
                  Your profile record, name, email, roll number, and phone number are permanently purged.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-good shrink-0 mt-0.5" />
                <span>Your digital Rider Pass is revoked and deleted.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-good shrink-0 mt-0.5" />
                <span>
                  Any uploaded student ID card photos in Supabase Storage are immediately destroyed.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-good shrink-0 mt-0.5" />
                <span>
                  Historical ride logs are anonymized (your personal user ID is replaced with null) for campus
                  audit records.
                </span>
              </li>
            </ul>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface/40 mt-16 py-8">
        <div className="max-w-3xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-muted">
          <p>CampusCycle · Open source campus mobility</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-fg transition-colors">
              Privacy Policy
            </Link>
            <Link href="/try" className="hover:text-fg transition-colors">
              Try Demo
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
