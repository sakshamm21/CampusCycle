'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Shield, Moon, Sun, Monitor, Lock, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase/browser';
import { useMyContext, useTheme } from '@/lib/providers';
import { toAppError, messageFor, t, en } from '@campuscycle/shared';
import { cn } from '@/lib/utils';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AccountPage() {
  const router = useRouter();
  const ctx = useMyContext();
  const { theme, setTheme } = useTheme();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const profile = ctx.profile;
  const isDemo = profile.is_demo;
  const isOwner = profile.is_owner;

  // Change password handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo) {
      toast.error('Demo passwords cannot be changed.');
      return;
    }

    if (newPassword.length < 8) {
      toast.error(messageFor('CC_WEAK_PASSWORD'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw toAppError(error);
      toast.success(en.a18.saved);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setSavingPassword(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.push('/sign-in');
    } catch (err) {
      console.error('Sign out error:', err);
      router.push('/sign-in');
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-4xl mx-auto w-full">
      <PageHeader
        kicker="preferences"
        title={t('a18.title')}
        lede="Your administrator identity, active campus affiliation, appearance theme, and security credentials."
      />

      {/* 1. Profile Card */}
      <section className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-full bg-surface2 border border-border flex items-center justify-center text-primary shrink-0">
              <User className="size-7" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-fg font-heading">{profile.full_name || 'Admin'}</h2>
                {isOwner && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    OWNER
                  </span>
                )}
                {isDemo && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                    DEMO
                  </span>
                )}
              </div>
              <span className="text-xs font-mono text-muted">{profile.email}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="ghost"
              disabled={signingOut}
              onClick={handleSignOut}
              className="rounded-full text-xs font-mono text-muted hover:text-bad hover:bg-bad/10 gap-1.5 cursor-pointer"
            >
              {signingOut ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
              <span>{en.a18.sign_out}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-mono text-muted uppercase">Role</span>
            <span className="text-sm font-mono font-bold text-fg capitalize flex items-center gap-1.5">
              <Shield className="size-3.5 text-primary" />
              {profile.role.replace('_', ' ')}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-mono text-muted uppercase">Campus</span>
            <span className="text-sm font-semibold text-fg">
              {ctx.college?.name || 'All Campuses (Super Admin)'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-mono text-muted uppercase">Status</span>
            <span className="text-sm font-mono font-bold text-good capitalize">{profile.status}</span>
          </div>
        </div>
      </section>

      {/* 2. Theme Preferences */}
      <section className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-bold text-fg font-heading">{en.a18.theme}</h3>
          <p className="text-xs text-muted">
            Choose how CampusCycle appears on your device. The choice persists with your account.
          </p>
        </div>

        <div className="inline-flex p-1 rounded-full bg-surface2 border border-border self-start">
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer',
              theme === 'system' ? 'bg-surface text-fg font-bold shadow-xs' : 'text-muted hover:text-fg',
            )}
          >
            <Monitor className="size-3.5" />
            <span>System</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer',
              theme === 'dark' ? 'bg-surface text-fg font-bold shadow-xs' : 'text-muted hover:text-fg',
            )}
          >
            <Moon className="size-3.5" />
            <span>Dark</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme('day')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer',
              theme === 'day' ? 'bg-surface text-fg font-bold shadow-xs' : 'text-muted hover:text-fg',
            )}
          >
            <Sun className="size-3.5" />
            <span>Day</span>
          </button>
        </div>
      </section>

      {/* 3. Change Password Section */}
      {!isDemo ? (
        <section className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-fg font-heading">{en.a18.change_pw}</h3>
            <p className="text-xs text-muted">
              Update your administrative login password. Minimum 8 characters required.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="flex flex-col gap-4 max-w-md pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-pw" className="text-xs font-mono">
                {en.a18.new_pw}
              </Label>
              <Input
                id="new-pw"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="bg-surface2 border-border text-xs font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-pw" className="text-xs font-mono">
                {en.a18.confirm_pw}
              </Label>
              <Input
                id="confirm-pw"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="bg-surface2 border-border text-xs font-mono"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={savingPassword}
                className="rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer"
              >
                {savingPassword ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3 animate-spin" />
                    <span>Updating...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Lock className="size-3.5" />
                    <span>{en.a18.change_pw}</span>
                  </span>
                )}
              </Button>
            </div>
          </form>
        </section>
      ) : (
        <section className="rounded-card border border-dashed border-border bg-surface/50 p-6 flex flex-col gap-2">
          <span className="text-xs font-mono font-bold text-muted uppercase">Password Management</span>
          <p className="text-xs text-muted leading-relaxed">
            Password changes are disabled for the demo accounts ({profile.email}) to prevent public lockouts.
          </p>
        </section>
      )}
    </div>
  );
}
