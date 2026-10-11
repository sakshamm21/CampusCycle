export const ACCENT: 'signal' | 'coral' | 'mint' = 'signal'; // the product accent

export const accents = {
  signal: {
    dark: { primary: '#FFD23F', onPrimary: '#16130A' },
    day: { primary: '#2448FF', onPrimary: '#FFFFFF' },
  },
  coral: {
    dark: { primary: '#FF6B5E', onPrimary: '#1C0907' },
    day: { primary: '#E0402F', onPrimary: '#FFFFFF' },
  },
  mint: {
    dark: { primary: '#3FE0B5', onPrimary: '#04241A' },
    day: { primary: '#0B7F60', onPrimary: '#FFFFFF' },
  },
} as const;

export const palette = {
  dark: {
    bg: '#0B0E13',
    surface: '#131821',
    surface2: '#1A202B',
    raised: '#1F2633',
    border: '#252D3A',
    borderStrong: '#354052',
    fg: '#F1F3F7',
    muted: '#9BA5B6',
    subtle: '#6A7487',
    primary: accents[ACCENT].dark.primary,
    onPrimary: accents[ACCENT].dark.onPrimary,
    ok: '#3FE0B5',
    warn: '#FFB020',
    bad: '#FF5470',
    grain: 0.07,
    shadow: 'rgba(0,0,0,0.6)',
    overlay: 'rgba(5,7,10,0.72)',
  },
  day: {
    bg: '#EDF0F4',
    surface: '#FFFFFF',
    surface2: '#E3E8EF',
    raised: '#FFFFFF',
    border: '#D5DCE5',
    borderStrong: '#B9C3D1',
    fg: '#0D1119',
    muted: '#556072',
    subtle: '#8790A0',
    primary: accents[ACCENT].day.primary,
    onPrimary: accents[ACCENT].day.onPrimary,
    ok: '#0E9F6E',
    warn: '#B87500',
    bad: '#DC2645',
    grain: 0.045,
    shadow: 'rgba(20,30,50,0.28)',
    overlay: 'rgba(13,17,25,0.45)',
  },
  sticker: {
    yellow: '#FFD23F',
    blue: '#4C74FF',
    coral: '#FF6B5E',
    mint: '#3FE0B5',
    ink: '#0B0E13',
    paper: '#FFFFFF',
  },
  pass: {
    fg: '#F1F3F7',
    muted: 'rgba(241,243,247,0.60)',
    line: 'rgba(255,255,255,0.13)',
    accent: accents[ACCENT].dark.primary,
    onAccent: accents[ACCENT].dark.onPrimary,
    chromeFg: '#0B0E13',
    chromeMuted: 'rgba(11,14,19,0.58)',
    chromeLine: 'rgba(11,14,19,0.16)',
    chromeAccent: '#2448FF',
    chromeOnAccent: '#FFFFFF',
    overdue: '#FFB020',
    onOverdue: '#1F1300',
    stamp: '#3FE0B5',
    onStamp: '#04150F',
    suspended: '#FF5470',
  },
} as const;

export const font = {
  display: 'ArchivoExpanded-Black',
  displayBold: 'ArchivoExpanded-ExtraBold',
  numeric: 'ArchivoCondensed-Black',
  accent: 'Fraunces-Italic',
  body: 'Figtree-Regular',
  bodyMedium: 'Figtree-Medium',
  bodySemibold: 'Figtree-SemiBold',
  bodyBold: 'Figtree-Bold',
  mono: 'MartianMono-Regular',
  monoMedium: 'MartianMono-Medium',
  monoBold: 'MartianMono-Bold',
} as const;

export const type = {
  displayXL: [44, 40, -0.05],
  displayL: [34, 32, -0.045],
  displayM: [26, 26, -0.04],
  displayS: [20, 21, -0.03],
  numericXL: [64, 56, -0.03],
  numericL: [52, 46, -0.02],
  numericM: [32, 30, -0.02],
  bodyL: [17, 26, 0],
  body: [15, 23, 0],
  bodyS: [13, 19, 0],
  label: [10.5, 13, 0.14],
  labelL: [12, 15, 0.12],
  button: [15, 15, -0.02],
} as const;

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 22,
  card: 26,
  sheet: 28,
  pill: 999,
} as const;

export const shadow = {
  card: { y: 18, blur: 40, spread: -16 },
  button: { y: 10, blur: 30, spread: -10 },
} as const;

export const motion = {
  press: { scale: 0.96, ms: 150 },
  fast: 180,
  base: 260,
  slow: 420,
  spring: { damping: 14, stiffness: 180, mass: 1 },
  easeOut: [0.2, 1.2, 0.4, 1],
  easeInOut: [0.6, 0, 0.2, 1],
} as const;
