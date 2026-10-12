'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bike, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/browser';
import { messageFor, DEMO_EMAILS, DEMO_PASSWORD, toAppError, en, type MyContext } from '@campuscycle/shared';
import { Headline } from '@/components/common/Headline';
import { Kicker } from '@/components/common/Kicker';
import { Sticker } from '@/components/common/Sticker';
import { Marquee } from '@/components/common/Marquee';
import { RiderPassWeb } from '@/components/pass/RiderPassWeb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const RIDER_WEB_URL = process.env.NEXT_PUBLIC_RIDER_WEB_URL || 'https://campuscycle-ride.vercel.app';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('e');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const displayError = errorCode ? messageFor(errorCode) : errorMsg;

  const handleAuthenticatedRedirect = async () => {
    // Verify admin role and approval status
    const { data: rawCtx, error: ctxError } = await supabase.rpc('get_my_context');
    const ctx = rawCtx as unknown as MyContext;

    if (ctxError || !ctx || ctx.profile?.role === 'rider' || ctx.profile?.status !== 'approved') {
      await supabase.auth.signOut();
      setErrorMsg(messageFor('CC_NOT_ADMIN'));
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw toAppError(error);
      }

      await handleAuthenticatedRedirect();
    } catch (err: unknown) {
      const appErr = toAppError(err);
      setErrorMsg(messageFor(appErr.code, appErr.data));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (demoEmail: string) => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: DEMO_PASSWORD,
      });

      if (error) {
        throw toAppError(error);
      }

      await handleAuthenticatedRedirect();
    } catch (err: unknown) {
      const appErr = toAppError(err);
      setErrorMsg(messageFor(appErr.code, appErr.data));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px] p-8 rounded-card border border-border bg-surface shadow-xl flex flex-col gap-6">
      {/* Mobile-only wordmark */}
      <div className="flex lg:hidden items-center gap-2.5 pb-2">
        <div className="size-8 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm shrink-0">
          <Bike className="size-5" />
        </div>
        <span className="font-display font-black text-xl tracking-[-0.04em] text-fg">campuscycle</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Kicker label="campuscycle · admin" />
        <Headline text="sign *in*" size="l" />
        <p className="text-muted text-sm">{en.a01.lede}</p>
      </div>

      {displayError && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-bad/15 border border-bad/30 text-bad text-xs flex items-start gap-2.5"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{displayError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-xs font-mono text-muted">
            {en.a01.email}
          </Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@college.edu"
            className="bg-surface2/60 border-border"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-xs font-mono text-muted">
            {en.a01.password}
          </Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-surface2/60 border-border"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-full font-bold bg-primary text-on-primary hover:opacity-90 mt-1 cursor-pointer"
        >
          {loading ? '...' : en.a01.submit}
        </Button>

        <p className="text-xs text-muted/80 text-center">{en.a01.forgot}</p>
      </form>

      {/* Demo divider */}
      <div className="pt-4 border-t border-border flex flex-col gap-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted text-center">
          {en.a01.demo_kicker}
        </span>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => handleDemoSignIn(DEMO_EMAILS.college_admin)}
            className="h-10 rounded-full text-xs font-mono border-border bg-surface2/50 hover:bg-surface2 cursor-pointer transition-colors"
          >
            {en.a01.demo_admin}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => handleDemoSignIn(DEMO_EMAILS.super_admin)}
            className="h-10 rounded-full text-xs font-mono border-border bg-surface2/50 hover:bg-surface2 cursor-pointer transition-colors"
          >
            {en.a01.demo_super}
          </Button>
        </div>
      </div>

      {/* Links row */}
      <div className="pt-2 border-t border-border flex flex-col gap-2.5 text-xs text-muted">
        <div className="flex items-center justify-between gap-2">
          <a
            href={RIDER_WEB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors inline-flex items-center gap-1 font-mono text-[11px]"
          >
            <span>{en.a01.rider_link}</span>
          </a>
          <Link
            href="/try"
            className="hover:text-primary transition-colors inline-flex items-center gap-1 font-mono text-[11px]"
          >
            <span>{en.a01.try_link}</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="flex items-center justify-center gap-4 pt-2 text-[11px] text-muted/70">
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
          <span>·</span>
          <Link href="/delete-account" className="hover:underline">
            Delete account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className="min-h-screen flex bg-bg text-fg overflow-hidden">
      {/* Left column (desktop showcase 45%) */}
      <section className="hidden lg:flex w-[45%] bg-surface2 border-r border-border flex-col justify-between p-12 overflow-hidden relative">
        <div className="flex flex-col gap-6 z-10">
          {/* Wordmark */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm shrink-0">
              <Bike className="size-5" />
            </div>
            <span className="font-display font-black text-2xl tracking-[-0.04em] text-fg">campuscycle</span>
          </div>

          <div className="flex flex-col gap-3 max-w-md pt-4">
            <Headline text={en.a01.title} size="xl" />
            <p className="text-muted text-base leading-relaxed">{en.a01.lede}</p>
          </div>

          {/* Stickers */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Sticker text={en.a01.s1} color="yellow" rotate={-5} />
            <Sticker text={en.a01.s2} color="blue" rotate={3} />
            <Sticker text={en.a01.s3} color="mint" rotate={-2} />
          </div>
        </div>

        {/* Marquee bands */}
        <div className="my-6 w-full -mx-12 overflow-hidden z-10">
          <Marquee />
        </div>

        {/* Static RiderPassWeb tilted -6° with idle sway */}
        <div className="w-full max-w-[340px] mx-auto z-10 mb-4">
          <div style={{ transform: 'rotate(-6deg)' }}>
            <RiderPassWeb
              holderName="Aanya Sharma"
              collegeName="IIT Kanpur"
              passLabel="IITK · 0421"
              state="ready"
              finish="graphite"
              idleSway={true}
              tiltOnHover={true}
              interactiveFlip={true}
            />
          </div>
        </div>

        {/* Subtle background glow */}
        <div
          aria-hidden="true"
          className="absolute -bottom-20 -left-20 size-80 rounded-full bg-primary/10 blur-3xl pointer-events-none"
        />
      </section>

      {/* Right column: Form card */}
      <section className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <Suspense fallback={<div className="text-muted font-mono text-xs">Loading...</div>}>
          <SignInForm />
        </Suspense>
      </section>
    </main>
  );
}
