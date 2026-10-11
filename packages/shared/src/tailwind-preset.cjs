/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        surface2: 'rgb(var(--surface2) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        'on-primary': 'rgb(var(--on-primary) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        bad: 'rgb(var(--bad) / <alpha-value>)',
      },
      borderRadius: {
        sm: '10px',
        md: '14px',
        lg: '22px',
        card: '26px',
        sheet: '28px',
        pill: '999px',
      },
      fontFamily: {
        display: ['ArchivoExpanded-Black', 'sans-serif'],
        displayBold: ['ArchivoExpanded-ExtraBold', 'sans-serif'],
        numeric: ['ArchivoCondensed-Black', 'sans-serif'],
        accent: ['Fraunces-Italic', 'serif'],
        body: ['Figtree-Regular', 'sans-serif'],
        bodyMedium: ['Figtree-Medium', 'sans-serif'],
        bodySemibold: ['Figtree-SemiBold', 'sans-serif'],
        bodyBold: ['Figtree-Bold', 'sans-serif'],
        mono: ['MartianMono-Regular', 'monospace'],
        monoMedium: ['MartianMono-Medium', 'monospace'],
        monoBold: ['MartianMono-Bold', 'monospace'],
      },
    },
  },
};
