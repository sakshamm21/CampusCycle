'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/browser';
import { messageFor, DEMO_EMAILS, DEMO_PASSWORD, toAppError } from '@campuscycle/shared';
import { Headline } from '@/components/common/Headline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('e');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const displayError = errorCode ? messageFor(errorCode) : errorMsg;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw toAppError(error);
      }

      router.push('/dashboard');
      router.refresh();
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

      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const appErr = toAppError(err);
      setErrorMsg(messageFor(appErr.code, appErr.data));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 rounded-card border border-border bg-surface shadow-xl flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-muted">CampusCycle · Admin</span>
        <Headline text="sign *in*" size="l" />
        <p className="text-muted text-sm">Campus admin portal for bicycle fleet management.</p>
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
            Email
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
            Password
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
          className="w-full h-11 rounded-full font-bold bg-primary text-on-primary hover:opacity-90 mt-2 cursor-pointer"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <div className="pt-4 border-t border-border flex flex-col gap-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted text-center">
          Demo logins (one click)
        </span>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => handleDemoSignIn(DEMO_EMAILS.college_admin)}
            className="h-9 rounded-full text-xs font-mono border-border bg-surface2/40 hover:bg-surface2 cursor-pointer"
          >
            College Admin
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => handleDemoSignIn(DEMO_EMAILS.super_admin)}
            className="h-9 rounded-full text-xs font-mono border-border bg-surface2/40 hover:bg-surface2 cursor-pointer"
          >
            Super Admin
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className="min-h-screen p-4 flex items-center justify-center bg-bg text-fg">
      <Suspense fallback={<div className="text-muted font-mono text-xs">Loading...</div>}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
