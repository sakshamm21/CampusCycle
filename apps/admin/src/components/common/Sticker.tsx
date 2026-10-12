import React from 'react';
import { cn } from '@/lib/utils';

export type StickerColor = 'yellow' | 'blue' | 'coral' | 'mint' | 'ink' | 'paper';

export interface StickerProps {
  text: string;
  color?: StickerColor;
  rotate?: number;
  className?: string;
}

export function Sticker({ text, color = 'yellow', rotate = -4, className = '' }: StickerProps) {
  const colorStyles: Record<StickerColor, { bg: string; text: string; border?: string }> = {
    yellow: { bg: 'bg-[#FFD23F]', text: 'text-[#0B0E13]' },
    blue: { bg: 'bg-[#4C74FF]', text: 'text-white' },
    coral: { bg: 'bg-[#FF6B5E]', text: 'text-[#0B0E13]' },
    mint: { bg: 'bg-[#3FE0B5]', text: 'text-[#0B0E13]' },
    ink: { bg: 'bg-[#0B0E13]', text: 'text-white', border: 'border border-borderStrong' },
    paper: { bg: 'bg-white', text: 'text-[#0B0E13]', border: 'border border-border' },
  };

  const current = colorStyles[color];

  return (
    <span
      style={{
        transform: `rotate(${rotate}deg)`,
        boxShadow: '0 14px 30px -10px rgba(0, 0, 0, 0.55)',
      }}
      className={cn(
        'inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-display font-extrabold tracking-tight select-none uppercase transition-transform',
        current.bg,
        current.text,
        current.border,
        className,
      )}
    >
      {text}
    </span>
  );
}
