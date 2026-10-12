'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/browser';
import { signedPhotoUrl } from '@campuscycle/shared';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PhotoThumbProps {
  bucket: 'id-cards' | 'return-photos' | 'issue-photos' | 'torq-photos';
  path: string | null;
  alt?: string;
  size?: number;
  className?: string;
}

export function PhotoThumb({ bucket, path, alt = 'Photo', size = 48, className = '' }: PhotoThumbProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { data: url, isLoading } = useQuery({
    queryKey: ['photo', bucket, path],
    queryFn: async () => {
      if (!path) return null;
      return signedPhotoUrl(supabase, bucket, path);
    },
    enabled: !!path,
    staleTime: 500_000,
  });

  if (!path) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn(
          'rounded-[8px] border border-border bg-surface2/50 flex items-center justify-center text-muted/60',
          className,
        )}
      >
        <ImageIcon className="size-4" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        style={{ width: size, height: size }}
        aria-label={`View ${alt}`}
        className={cn(
          'relative rounded-[8px] overflow-hidden border border-border bg-surface2 shrink-0 group hover:ring-2 hover:ring-primary/60 transition-all cursor-pointer',
          className,
        )}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            <Loader2 className="size-3.5 animate-spin" />
          </div>
        ) : url ? (
          <Image
            src={url}
            alt={alt}
            fill
            sizes={`${size}px`}
            className="object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            <ImageIcon className="size-4" />
          </div>
        )}
      </button>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-3xl p-2 bg-surface/95 border-border backdrop-blur-md">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {url && (
            <div className="relative w-full aspect-4/3 max-h-[80vh] rounded-lg overflow-hidden flex items-center justify-center">
              <Image
                src={url}
                alt={alt}
                fill
                sizes="(max-width: 1200px) 100vw, 1200px"
                className="object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
