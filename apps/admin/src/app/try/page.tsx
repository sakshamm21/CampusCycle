'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import {
  Bike,
  Shield,
  QrCode,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase/browser';
import { DEMO_EMAILS, DEMO_PASSWORD, toAppError, messageFor, t, en } from '@campuscycle/shared';
import { Headline } from '@/components/common/Headline';
import { Kicker } from '@/components/common/Kicker';
import { Button } from '@/components/ui/button';

const RIDER_WEB_URL = process.env.NEXT_PUBLIC_RIDER_WEB_URL || 'https://campuscycle-ride.vercel.app';
const APK_URL =
  process.env.NEXT_PUBLIC_APK_URL || 'https://github.com/sakshamm21/CampusCycle/releases/latest';

interface QrSample {
  code: string;
  stand_name: string;
  payload: string;
}

export default function TryPage() {
  const router = useRouter();
  const [showAllQrs, setShowAllQrs] = useState(false);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [signingInRole, setSigningInRole] = useState<string | null>(null);

  // 1. Fetch sample bike QRs from RPC demo_qr_samples (publicly callable)
  const { data: samples = [], isLoading: samplesLoading } = useQuery({
    queryKey: ['demo-qr-samples'],
    queryFn: async (): Promise<QrSample[]> => {
      const { data, error } = await supabase.rpc('demo_qr_samples');
      if (error) throw error;
      return (data ?? []) as QrSample[];
    },
  });

  // 2. Generate QR code images client-side
  useEffect(() => {
    if (samples.length === 0) return;
    let active = true;

    async function generateAll() {
      const generated: Record<string, string> = {};
      for (const item of samples) {
        try {
          generated[item.code] = await QRCode.toDataURL(item.payload, {
            width: 160,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });
        } catch (err) {
          console.error(`Failed to generate QR for ${item.code}:`, err);
        }
      }
      if (active) {
        setQrImages(generated);
      }
    }

    generateAll();
    return () => {
      active = false;
    };
  }, [samples]);

  // Demo Sign-in Handler
  const handleDemoSignIn = async (role: 'college_admin' | 'super_admin', email: string) => {
    setSigningInRole(role);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: DEMO_PASSWORD,
      });

      if (error) throw toAppError(error);

      toast.success(`Signed in as demo ${role.replace('_', ' ')}.`);
      router.push('/dashboard');
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setSigningInRole(null);
    }
  };

  const displayedSamples = showAllQrs ? samples : samples.slice(0, 6);

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col justify-between selection:bg-primary selection:text-on-primary">
      {/* Top Navbar */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="size-8 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-xs">
              <Bike className="size-5" />
            </div>
            <span className="font-heading font-black text-lg tracking-tight lowercase">campuscycle</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2"
              >
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16 flex flex-col gap-12 w-full">
        {/* Hero Section */}
        <div className="flex flex-col gap-4 max-w-3xl">
          <Kicker text="interactive preview" />
          <Headline text={t('try.title')} size="xl" className="leading-tight" />
          <p className="text-muted text-base md:text-lg leading-relaxed">{en.try.lede}</p>
        </div>

        {/* Three Pillar Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Ride it */}
          <div className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col justify-between gap-6">
            <div className="flex flex-col gap-4">
              <div className="size-12 rounded-2xl bg-surface2 border border-border flex items-center justify-center text-primary">
                <Smartphone className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-heading font-bold text-fg lowercase">1. {en.try.ride}</h2>
                <p className="text-xs text-muted leading-relaxed">
                  Experience the animated Rider Pass, scan bikes, and explore live campus stands.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t border-border">
              <a href={RIDER_WEB_URL} target="_blank" rel="noreferrer" className="w-full">
                <Button
                  type="button"
                  className="w-full rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 gap-1.5 cursor-pointer"
                >
                  <span>Open the rider app</span>
                  <ExternalLink className="size-3.5" />
                </Button>
              </a>
              <span className="text-[11px] font-mono text-muted leading-relaxed px-1">
                Tap <strong>Try the demo rider</strong>. Location checks are off in the demo.
              </span>

              <a href={APK_URL} target="_blank" rel="noreferrer" className="w-full pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full text-xs font-mono border-border bg-surface2 hover:bg-surface gap-1.5 cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>Download for Android</span>
                </Button>
              </a>
            </div>
          </div>

          {/* Card 2: Run it */}
          <div className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col justify-between gap-6">
            <div className="flex flex-col gap-4">
              <div className="size-12 rounded-2xl bg-surface2 border border-border flex items-center justify-center text-primary">
                <Shield className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-heading font-bold text-fg lowercase">2. {en.try.run}</h2>
                <p className="text-xs text-muted leading-relaxed">
                  Log in directly to test fleet management, rider approvals, stand geofencing, and live maps.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                disabled={!!signingInRole}
                onClick={() => handleDemoSignIn('college_admin', DEMO_EMAILS.college_admin)}
                className="w-full rounded-full text-xs font-mono font-bold bg-surface2 hover:bg-surface border border-border text-fg gap-2 cursor-pointer h-10"
              >
                {signingInRole === 'college_admin' ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <Shield className="size-4 text-primary" />
                )}
                <span>{en.a01.demo_admin}</span>
              </Button>

              <Button
                type="button"
                disabled={!!signingInRole}
                onClick={() => handleDemoSignIn('super_admin', DEMO_EMAILS.super_admin)}
                className="w-full rounded-full text-xs font-mono font-bold bg-surface2 hover:bg-surface border border-border text-fg gap-2 cursor-pointer h-10"
              >
                {signingInRole === 'super_admin' ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <Sparkles className="size-4 text-primary" />
                )}
                <span>{en.a01.demo_super}</span>
              </Button>

              <span className="text-[11px] font-mono text-muted text-center pt-1">
                One-click authenticated access · no password needed
              </span>
            </div>
          </div>

          {/* Card 3: Scan it */}
          <div className="rounded-card border border-border bg-surface p-6 shadow-xs flex flex-col justify-between gap-6 lg:col-span-1">
            <div className="flex flex-col gap-4">
              <div className="size-12 rounded-2xl bg-surface2 border border-border flex items-center justify-center text-primary">
                <QrCode className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-heading font-bold text-fg lowercase">3. {en.try.scan}</h2>
                <p className="text-xs text-muted leading-relaxed">
                  Live signed bicycle QR codes ready to scan straight from your laptop screen.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t border-border">
              <span className="text-xs text-muted leading-relaxed">{en.try.scan_note}</span>
              <div className="pt-2">
                <span className="text-[11px] font-mono text-primary font-bold">
                  {samples.length} bikes currently parked at stands
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sample Bike QR Grid Section */}
        <section className="flex flex-col gap-6 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
            <div>
              <h3 className="text-lg font-heading font-bold text-fg lowercase">sample bicycle qr stickers</h3>
              <p className="text-xs text-muted">
                Each QR sticker carries an HMAC cryptographically signed token verifying the bike belongs to
                the campus pool.
              </p>
            </div>

            {samples.length > 6 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAllQrs((prev) => !prev)}
                className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                {showAllQrs ? (
                  <>
                    <span>Show fewer</span>
                    <ChevronUp className="size-3.5" />
                  </>
                ) : (
                  <>
                    <span>Show all ({samples.length})</span>
                    <ChevronDown className="size-3.5" />
                  </>
                )}
              </Button>
            )}
          </div>

          {samplesLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-card border border-border bg-surface p-4 flex flex-col items-center gap-2 animate-pulse"
                >
                  <div className="size-32 bg-surface2 rounded-lg" />
                  <div className="h-4 w-16 bg-surface2 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {displayedSamples.map((item) => (
                <div
                  key={item.code}
                  className="rounded-card border border-border bg-surface p-3 flex flex-col items-center gap-2.5 shadow-xs hover:border-primary/50 transition-colors"
                >
                  <div className="p-2 bg-white rounded-lg flex items-center justify-center shadow-xs">
                    {qrImages[item.code] ? (
                      <img
                        src={qrImages[item.code]}
                        alt={`QR Code for bike ${item.code}`}
                        className="size-32 object-contain"
                      />
                    ) : (
                      <div className="size-32 flex items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-muted" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <span className="font-mono text-xs font-bold text-fg bg-surface2 px-2 py-0.5 rounded-full border border-border">
                      {item.code}
                    </span>
                    <span className="text-[10px] text-muted truncate max-w-[120px] mt-1">
                      {item.stand_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface/40 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-muted">
          <p>{en.try.reset}</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-fg transition-colors">
              Privacy Policy
            </Link>
            <Link href="/delete-account" className="hover:text-fg transition-colors">
              Delete Account
            </Link>
            <a
              href="https://github.com/sakshamm21/CampusCycle"
              target="_blank"
              rel="noreferrer"
              className="hover:text-fg transition-colors"
            >
              GitHub Repo
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
