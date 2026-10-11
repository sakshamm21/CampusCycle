'use client';

import { useState, useEffect } from 'react';
import { Headline } from '@/components/common/Headline';

export default function HomePage() {
  const [theme, setTheme] = useState<'dark' | 'day'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <main className="min-h-screen p-8 md:p-16 flex flex-col items-center justify-center gap-8 bg-bg text-fg">
      <div className="max-w-2xl w-full p-8 rounded-card border border-border bg-surface shadow-lg flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-widest text-muted">
            CampusCycle Admin · P0 Foundation
          </span>
          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'day' : 'dark'))}
            className="px-4 py-2 rounded-full border border-border bg-surface2 text-fg hover:bg-raised text-sm font-medium transition-colors cursor-pointer"
          >
            Switch to {theme === 'dark' ? 'Day' : 'Dark'} Mode
          </button>
        </div>

        <div className="space-y-4">
          <Headline text="campus*cycle* · fleet *live*" size="xl" />
          <Headline text="hey *saksham*, stands are looking *healthy*" size="l" />
          <Headline text="active *rides* right now" size="m" />
        </div>

        <p className="text-muted text-sm leading-relaxed">
          The foundation for the CampusCycle Admin portal is initialized. All Google Fonts (Archivo Expanded,
          Fraunces Italic, Figtree, Martian Mono) and design tokens are loaded and rendering properly in both
          dark and day themes.
        </p>

        <div className="pt-4 border-t border-border flex items-center justify-between text-xs font-mono text-subtle">
          <span>Current theme: {theme}</span>
          <span className="text-ok font-semibold">● Ready</span>
        </div>
      </div>
    </main>
  );
}
