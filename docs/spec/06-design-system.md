# 06 · Design system

One visual system for the rider app and the admin web app: heavy lowercase headlines with one italic serif accent word, tiny mono labels, tilted stickers, pill buttons that squish, a floating dock, dark-first with a soft glow and film grain. The style is inspired by the owner's own "Sync" app but uses **CampusCycle's own colours and fonts**, never Sync's. The Rider Pass is a CRED-style animated card in the **Ink** style with the **Signal** accent.

The reference board `reference/ui-board.html` (open it in a browser) is the visual source of truth for everything this file describes in words, and its `.pass` CSS is the reference implementation of the web Rider Pass (§6.7). Build only what this file describes. The board's accent switch also previews Coral and Mint, the two alternatives the `ACCENT` constant supports (§2.1); Signal is the product accent.

## 1. Rules

1. Dark theme is the default ("after dark"). The day theme is complete and equal in quality. The user picks System / Dark / Day in Profile (R19) and My account (A18); System follows the device.
2. Exactly one accent colour (Signal). It is used for: primary buttons, the italic accent word in headlines, the riding glow, active dock icon, focus rings, links. Nothing else.
3. Status colours never change with the accent: **ok** = available/riding/returned, **warn** = overdue/heads-up, **bad** = problems/suspended/strikes.
4. Headlines are lowercase, heavy, tight. Labels (metadata, codes, timestamps) are mono, uppercase, letter-spaced. Body text is a calm sans.
5. Big rounded cards (radius 26–28), pill buttons, generous spacing. No hard 1px boxes as decoration; borders are subtle.
6. Every screen has a soft ambient glow behind the top-left and a film-grain overlay at low opacity.
7. Tilted stickers (rounded pills rotated −6° to +7°) are used sparingly as fun accents: on Welcome, on the Returned receipt, on empty states.

## 2. Tokens (`packages/shared/src/tokens.ts`)

### 2.1 Colours (exact)

```ts
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
    primary: '#FFD23F',
    onPrimary: '#16130A', // Signal after dark: yellow
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
    primary: '#2448FF',
    onPrimary: '#FFFFFF', // Signal by day: blue
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
    // the card keeps its own colours in both themes
    fg: '#F1F3F7',
    muted: 'rgba(241,243,247,0.60)',
    line: 'rgba(255,255,255,0.13)',
    accent: '#FFD23F',
    onAccent: '#16130A',
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
```

The accent is a single build-time constant so it can be swapped in one line:

```ts
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
```

`palette.dark.primary/onPrimary`, `palette.day.primary/onPrimary` and `palette.pass.accent/onAccent` are read from `accents[ACCENT]` (the literal values above show Signal). Only Signal is built and tested; the other two exist so Sak can switch without design work. Users cannot change the accent in the app; they can change the theme (System / Dark / Day).

### 2.2 Type, space, radius, shadow, motion

```ts
export const font = {
  display: 'ArchivoExpanded-Black', // headlines, names
  displayBold: 'ArchivoExpanded-ExtraBold', // buttons, card titles, stickers
  numeric: 'ArchivoCondensed-Black', // timers, bike ids, scoreboard numbers
  accent: 'Fraunces-Italic', // the one italic accent word
  body: 'Figtree-Regular',
  bodyMedium: 'Figtree-Medium',
  bodySemibold: 'Figtree-SemiBold',
  bodyBold: 'Figtree-Bold',
  mono: 'MartianMono-Regular',
  monoMedium: 'MartianMono-Medium',
  monoBold: 'MartianMono-Bold',
} as const;

export const type = {
  // [fontSize, lineHeight, letterSpacing(em)]
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

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;
export const radius = { sm: 10, md: 14, lg: 22, card: 26, sheet: 28, pill: 999 } as const;
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
  easeOut: [0.2, 1.2, 0.4, 1], // cubic-bezier for dock/bounces
  easeInOut: [0.6, 0, 0.2, 1], // mint reveal
} as const;
```

Screen padding: 16 px sides on mobile, 24 px on admin. Vertical rhythm between blocks: 12 px (tight) or 24 px (sections).

### 2.3 Theme hook (mobile)

`src/theme/ThemeProvider.tsx` reads `profile.theme` (or AsyncStorage `cc-theme` before sign-in) and `useColorScheme()`. Exposes `useTheme(): { mode: 'dark' | 'day', c: typeof palette.dark, setTheme(t) }`. `setTheme` updates AsyncStorage immediately and `updateMyProfile({ theme })` when signed in. NativeWind dark mode uses `class` strategy driven by this provider (`colorScheme.set()` from `nativewind`).

### 2.4 NativeWind preset (mobile)

`packages/shared/src/tailwind-preset.cjs` exports a Tailwind 3 preset generated from `tokens.ts` values (colours as CSS variables so themes switch): `colors: { bg: 'rgb(var(--bg) / <alpha-value>)', surface, surface2, raised, border, 'border-strong', fg, muted, subtle, primary, 'on-primary', ok, warn, bad }`, `borderRadius` from `radius`, `fontFamily` from `font`. `apps/mobile/global.css` defines the variables for `:root` (dark) and `.day` (day) as space-separated RGB triples. `apps/mobile/tailwind.config.js`: `presets: [require('nativewind/preset'), require('@campuscycle/shared/src/tailwind-preset.cjs')]`, `content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}']`.

### 2.5 Admin tokens (`apps/admin/src/app/tokens.css`)

Generated by `pnpm tokens` (`scripts/gen-tokens.mjs`), never edited by hand:

```css
@theme {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface2: var(--surface2);
  --color-raised: var(--raised);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-fg: var(--fg);
  --color-muted: var(--muted);
  --color-subtle: var(--subtle);
  --color-primary: var(--primary);
  --color-on-primary: var(--on-primary);
  --color-ok: var(--ok);
  --color-warn: var(--warn);
  --color-bad: var(--bad);
  --radius-card: 26px;
  --radius-sheet: 28px;
  --font-display: var(--font-archivo);
  --font-accent: var(--font-fraunces);
  --font-body: var(--font-figtree);
  --font-mono: var(--font-martian);
}
:root {
  /* dark values from palette.dark */
}
:root[data-theme='day'] {
  /* day values */
}
@media (prefers-color-scheme: light) {
  :root[data-theme='system'] {
    /* day values */
  }
}
```

shadcn's own variables (`--background`, `--foreground`, `--primary`, `--card`, `--border`, `--ring`, `--destructive` …) are mapped onto these in `globals.css` so shadcn components inherit the palette (`--background: var(--bg)`, `--card: var(--surface)`, `--primary: var(--primary)`, `--primary-foreground: var(--on-primary)`, `--destructive: var(--bad)`, `--ring: var(--primary)`, `--radius: 14px`).

## 3. Typography

### 3.1 Families (all free Google Fonts, OFL)

| Role    | Family                                             | Used for                                        |
| ------- | -------------------------------------------------- | ----------------------------------------------- |
| Display | Archivo, width 125 (Expanded), weights 900 and 800 | headlines, names on the pass, buttons, stickers |
| Numeric | Archivo, width 75 (Condensed), weight 900          | timers, bike ids, scoreboard numbers            |
| Accent  | Fraunces Italic, weight 400                        | the one accent word per headline                |
| Body    | Figtree 400/500/600/700                            | everything people read                          |
| Mono    | Martian Mono 400/500/700                           | labels, pass and bike numbers, kickers, chips   |

### 3.2 Getting the files

Mobile needs static `.ttf` files. `scripts/fetch-fonts.mjs` requests the Google Fonts CSS API with an old user agent (`Mozilla/4.0 (compatible; MSIE 8.0)`), which makes it return TrueType URLs for exactly the requested axis values, downloads them and saves:

| Request (`https://fonts.googleapis.com/css2?family=...`) | Saved as `apps/mobile/assets/fonts/`                      |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `Archivo:wdth,wght@125,900`                              | `ArchivoExpanded-Black.ttf`                               |
| `Archivo:wdth,wght@125,800`                              | `ArchivoExpanded-ExtraBold.ttf`                           |
| `Archivo:wdth,wght@75,900`                               | `ArchivoCondensed-Black.ttf`                              |
| `Fraunces:ital,wght@1,400`                               | `Fraunces-Italic.ttf`                                     |
| `Figtree:wght@400` / `500` / `600` / `700`               | `Figtree-Regular.ttf` / `-Medium` / `-SemiBold` / `-Bold` |
| `Martian+Mono:wght@400` / `500` / `700`                  | `MartianMono-Regular.ttf` / `-Medium` / `-Bold`           |

If a response contains several `@font-face` blocks (subsets), take the block whose `unicode-range` includes `U+0000-00FF`, or the only block. The files are committed. `apps/mobile/app/_layout.tsx` loads them with `useFonts` from `expo-font` using the names in `font` (§2.2) and keeps the splash screen up until loaded.

Admin uses `next/font/google` in `src/app/layout.tsx`:

```ts
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['italic'],
  weight: ['400'],
  variable: '--font-fraunces',
});
const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-figtree',
});
const martian = Martian_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-martian',
});
```

Display text on the web uses `font-family: var(--font-display); font-weight: 900; font-stretch: 125%`; numeric uses `font-stretch: 75%`.

### 3.3 Scale usage

| Style                         | Mobile use                                              | Admin use                           |
| ----------------------------- | ------------------------------------------------------- | ----------------------------------- |
| displayXL 44                  | screen hero headline (Home greeting, Pending, Returned) | page title (`h1`) at 40px           |
| displayL 34                   | section headlines, stand name on Stand detail           | dashboard greeting                  |
| displayM 26                   | card titles, sheet titles                               | card titles                         |
| displayS 20                   | list primary text in big lists, sticker                 | table section headers               |
| numericXL 64                  | ride timer (R13)                                        | —                                   |
| numericL 52                   | bike id on Borrow (R12), receipt duration               | scoreboard numbers (StatTile) at 56 |
| numericM 32                   | stats on pass back, stand free count                    | small stat numbers                  |
| bodyL / body / bodyS          | paragraphs, rows, helper text                           | same                                |
| label 10.5 mono upper +0.14em | kickers, chip text, metadata                            | same                                |

## 4. Icons and brand

- Icons: `lucide-react-native` (mobile) and `lucide-react` (admin), stroke width 2, size 20 (dock 20, buttons 18, inline 16).
- Brand mark: a filled circle in `primary` with a simple bicycle glyph (lucide `Bike`) in `onPrimary`, 70% of the circle size. Wordmark: `campuscycle` in display font, lowercase, letter-spacing −0.04em, next to the mark.
- TORQ mark: a rounded square (radius 14) in `fg` with a lucide `Zap` glyph in `bg`. Inline it reads `TORQ` in mono bold.
- App icon (1024²): background `#0B0E13`, centered yellow `#FFD23F` circle (64% of width) with the black bike glyph. Adaptive icon foreground: the same circle and glyph at 66% safe zone on transparent. Splash: the mark (200 px) centered on `#0B0E13`. Notification icon: white bike glyph on transparent, 96². These four PNGs (and, with `--feature`, the 1024×500 store feature graphic: mark, wordmark and the line "ride anywhere on campus." on `#0B0E13`) are generated by `scripts/make-icons.mjs` with `sharp` from inline SVG (path data of lucide `Bike`), so no design tool is needed.

## 5. Components

All mobile components live in `apps/mobile/src/components/`; admin equivalents in `apps/admin/src/components/` (folders in 05 §2; built on shadcn where noted). Same names in both.

### 5.1 `Text`

Wraps RN `Text`. Props: `variant` (`body` default, `bodyL`, `bodyS`, `label`, `labelL`, `display*`, `numeric*`), `tone` (`fg` default, `muted`, `subtle`, `primary`, `ok`, `warn`, `bad`), `upper` (labels are upper by default). Applies `maxFontSizeMultiplier={1.3}`. `numeric*` variants set `fontVariant: ['tabular-nums']`.

### 5.2 `Headline`

Props `text` (copy with `*accent*` markers), `size` (`xl` | `l` | `m`). Renders lowercase display text; the part between asterisks renders in `font.accent`, size ×1.04, colour `primary`, letter-spacing −0.01em. Example: `hey *aanya*` → "hey" in Archivo Black + "aanya" in Fraunces italic yellow.

### 5.3 `Kicker`

Mono label, `muted`, with an optional leading 8 px live dot (`ok` colour, pulsing ping animation 1.6 s, disabled with reduce motion).

### 5.4 `Pill` (button)

Variants: `primary` (bg `primary`, text `onPrimary`, shadow tinted with primary at 60%), `secondary` (bg `surface2`, border `border`, text `fg`), `ghost` (transparent, text `fg`), `danger` (bg `bad`, text white), `inverse` (bg `fg`, text `bg`). Sizes: `lg` (height 56, padding 22, text `button` 16), `md` (48, 18, 15), `sm` (36, 12, 13). Radius pill. Text in `font.displayBold` lowercase for `lg`, `font.bodyBold` sentence case for `md`/`sm`. Press: scale to 0.96 over 150 ms (Reanimated `withTiming`), haptic `selection` on native. `loading` shows a 18 px spinner in place of the text and keeps width. `disabled` → opacity 0.4, no press.

### 5.5 `IconButton`

44×44 circle, `surface2` background, `border` border, icon `fg`. Props `icon`, `label` (accessibility), `onPress`, `badge?: number` (red `bad` dot with count, max "9+").

### 5.6 `Card`

`surface` background, 1 px `border`, radius `card` (26), padding 16. Variant `raised` adds the card shadow. Variant `outlineDashed` (1.5 px dashed `primary`) is used only by `ConfirmCard`.

### 5.7 `Sticker`

Pill text label, `font.displayBold` 14, padding 7/14, text `#0B0E13` (or white on blue/ink), background one of the sticker colours, rotation prop (−6..7°), shadow `0 14 30 -10 rgba(0,0,0,.55)`.

### 5.8 `Chip` and `StatusPill`

Chip: mono 10 px, radius pill, padding 5/9, `surface2` bg, `border`, text `muted`; `tone` changes text colour. StatusPill: mono 10 upper, padding 6/10, background = tone at 14% opacity, text = tone, leading 6 px dot. Bike status → tone: available ok, borrowed primary, maintenance warn, missing bad, retired subtle. Pass/ride: riding primary, overdue warn, suspended bad, pending subtle, ready ok.

### 5.9 `Dock` (mobile tab bar)

Floating capsule 16 px above the bottom safe area, horizontal margin 16, height 64, radius pill, background `raised` at 85% opacity with blur (expo-blur is not used; plain colour is fine), border `border`, card shadow. Contents left to right: `Home` (house), `Map` (map), centre raised button, `History` (receipt), `Profile` (user). Icon buttons 42×42; active one gets `primary` background and `onPrimary` icon. The centre button is 52 high, padding 18/20, radius pill, background `fg`, text `bg`, icon + label in display font lowercase: `borrow` (scan-line icon) when the pass is ready, `return` (corner-down-left icon) when riding/overdue, and hidden (replaced by a 52 px spacer) when the pass is pending or suspended. It navigates to R11 (borrow) or R14 (return).

### 5.10 `TorqFab`

40×40 rounded square (radius 14), background `fg`, TORQ mark; positioned bottom-right, 16 px from the edge, 12 px above the dock (or above the safe area when no dock). Hidden on auth screens, R05, R11, R17 and while the keyboard is open. Opens R17 as a modal route. Long-press opens R17 with the mic already listening.

### 5.11 `SlideToConfirm`

Track height 58, radius pill, `surface` bg, `border`. Thumb 50 circle, `primary` bg, arrow-right icon `onPrimary`, starts at x=4. Label centred, display font 16 lowercase, `muted`, left padding 40. A fill behind the thumb in `primary` at 22% opacity grows with the thumb. Gesture Handler pan: thumb follows the finger; release past 85% of the track → snaps to the end (spring), haptic `impactAsync(Heavy)`, calls `onConfirm` once; otherwise springs back. While `loading`, the thumb shows a spinner and the gesture is disabled. Accessibility: also a plain button for screen readers (`accessibilityActions: [{ name: 'activate' }]`) that calls `onConfirm`.

### 5.12 `Sheet`

Bottom sheet (mobile) built with Reanimated: overlay `overlay` colour, panel `surface`, top radius `sheet` (28), grab handle 36×4 `borderStrong`, padding 16 + bottom safe area. Drag down 25% or tap overlay to close. Admin uses shadcn `Sheet` (right side, width 480) and `Dialog`.

### 5.13 `Toast` and `Banner`

Toast: top of screen below the status bar, `raised` card, 14 radius, icon by tone, body text, auto-hide 3.5 s, swipe up to dismiss. Admin uses shadcn `sonner` with the same tones. Banner: full-width strip under the header, tone background at 14%, tone text, one line plus optional action; used for offline (`warn`) and demo mode (`primary` at 14%: `en.common.demo_banner`).

### 5.14 `Skeleton`, `EmptyState`, `ErrorState`

Skeleton: `surface2` blocks with a shimmer (opacity 0.5 ↔ 1, 1.2 s; static with reduce motion). EmptyState: tilted sticker + headline (displayM) + body + optional button. ErrorState: lucide `CloudOff` or `TriangleAlert` icon in `bad`, title, `messageFor(code)`, button `en.common.try_again`.

### 5.15 `Field`

Label (mono label, `muted`) above a 52-high input: `surface` bg, 1 px `border`, radius 14, body text, focus border `primary` 1.5 px. Error text under it in `bad`, bodyS. Password fields have an eye toggle IconButton (32). Admin uses shadcn `Input` with matching classes.

### 5.16 `Segmented`

Capsule with 4 px padding, `surface` bg, `border`; options are pill buttons; selected = `fg` bg + `bg` text. Used for List/Map toggle, theme picker, filters.

### 5.17 `ConfirmCard` (TORQ action)

Card variant `outlineDashed`, radius 22, padding 12. Kicker `TORQ wants to`; title in `font.displayBold` 15 (`preview.title`); a list of `preview.lines` each prefixed by `→ ` in `primary`; then two Pills `sm`: `Confirm` (primary) and `Cancel` (secondary). After decision it shows a StatusPill: `done` ok, `cancelled` subtle, `expired` subtle, `failed` bad + error copy. Expired cards show the pill instead of buttons. Countdown chip `expires in 12 min` (mono) updates every 30 s.

### 5.18 `ChatBubble`, `StepChips`, `AskBar`

User bubble: right aligned, max 86% width, `fg` bg, `bg` text, radius 22 with bottom-right 6. Assistant bubble: left, `surface` bg, `border`, radius 22 with bottom-left 6; supports bold and bullet lists (simple markdown: `**bold**`, `- ` lists, line breaks only). A small speaker IconButton (28) under assistant bubbles reads the reply aloud. StepChips: row of Chips with `ok` text and a ✓ prefix when a step ended ok, a spinner while running, `bad` ✕ when failed. AskBar: capsule, `surface` bg, `border`, placeholder `en.r17.placeholder`, camera IconButton (left), send IconButton, and a 38 px `primary` mic circle on the right (hold to talk).

### 5.19 `Receipt` (ticket stub, ride summary)

Top part: `primary` background, `onPrimary` text, top radius 22, bottom corners cut by two 10 px half-circle notches (mask). Bottom part: `surface`, bottom radius 22, top notches, 2 px dashed `borderStrong` line at the top inset 16. Content defined in R15. Native implementation: draw with `react-native-svg` (`Path` with arcs) behind the content.

### 5.20 `StatTile` (admin scoreboard)

Card with kicker label, a numericL (56 px admin) number, and a muted sub line. Optional tone on the number (warn for overdue > 0, bad for missing > 0).

### 5.21 `Marquee`

A rotated (−2.2°) full-bleed band in `primary` with repeating lowercase display text `borrow · ride · return at any stand ·` scrolling left (32 s loop, stopped with reduce motion). A second band (`fg` bg, mono uppercase, rotated +1.4°) scrolls the other way (38 s). Used only on R01 Welcome and the admin A01 sign-in page.

### 5.22 `Glow` and `Grain`

Glow: three blurred circles absolutely positioned behind content: top-left 340 px `primary` at 14%, right-middle 280 px sticker blue at 12%, bottom 260 px coral at 9%. Native: Skia `Circle` with `BlurMask` blur 60. Grain: a full-screen non-interactive overlay with fractal noise at the theme's `grain` opacity (native: Skia `Fill` + `FractalNoise` shader freq 0.85 octaves 3, blend `overlay`; web: the SVG noise data-URI from the board). Both are rendered once in the root layout, behind/above all screens respectively.

### 5.23 `StandPin` (maps)

Circle 34 px: `surface` fill, 2 px border in `ok` (free ≥ 3), `warn` (1–2) or `bad` (0); centre text = free count in numeric 14. Selected pin scales to 1.2 and shows the stand name label below in mono. Admin pins add a small ring segment for maintenance bikes in `warn`.

## 6. The Rider Pass (`RiderPass`)

The hero of the app. Card aspect ratio **1.586** (credit card), width = screen width − 32 (max 440). All inner sizes are in card units `u = width / 100` (the board's `cqw`).

### 6.1 Props

```ts
type PassState = 'pending' | 'minting' | 'ready' | 'riding' | 'overdue' | 'returned' | 'suspended';
interface RiderPassProps {
  state: PassState;
  finish: Finish; // graphite | chrome | holo
  name: string; // full name; first word shown large, rest as accent line
  collegeShort: string; // IITK
  passLabel: string | null; // IITK · 0421 (null while pending)
  rides: number;
  bikeCode?: string; // when riding/overdue/returned
  fromStand?: string;
  startedAt?: string;
  dueAt?: string;
  returnedStamp?: { stand: string; minutes: number };
  appliedAt?: string; // pending
  suspendedReason?: string | null;
  qr?: { payload: string; expiresAt: string } | null; // back face
  stats?: PassStats; // back face
  interactive?: boolean; // tilt + flip (true on Home)
  onFlip?(flipped: boolean): void;
}
```

### 6.2 Front face anatomy (Ink direction)

- Background (Graphite): `linear-gradient(140deg, #1E232C, #0E1116 55%, #1A1F28)` + top-left radial highlight white 11% + fine diagonal hairlines (repeating 100°, white 3%, 1 px every 4 px).
- Chrome finish: light metal gradient `120deg: #DDE2E9 0%, #9AA3B1 28%, #F4F6F9 48%, #8D97A6 70%, #D3D9E1 100%` + highlight white 70%; text switches to the `chrome*` pass colours.
- Holo finish: dark base `140deg: #1D1F30, #0D0F17 55%, #1E1B2D` plus a rainbow layer `115deg: transparent 12%, #FF6B5E 26%, #FFD23F 37%, #3FE0B5 49%, #4C74FF 61%, #B06BFF 72%, transparent 86%` at 42% opacity, colour-dodge, positioned by tilt.
- Corner radius 6u. Inset 1 px white 8% hairline.
- Content padding 6u × 6.5u in a 4-row grid:
  1. **Top row:** brand (6.2u accent circle with bike glyph + `campuscycle` display 4.2u) on the left; kicker `RIDER PASS` mono 2.5u `muted` on the right.
  2. **Middle row:** the **chip slot** (15u × 11u, radius 2.6u, 0.45u dashed `line` border, label `DOCK` mono 2.1u) and a status pill (mono 2.5u, see states) to its right.
  3. **Name:** first name lowercase display 8.6u, line-height 0.86; below it the last name in Fraunces italic 6u in `accent`.
  4. **Bottom row:** mono 2.6u `muted` items: `{passLabel}` (bold `fg`) · `{rides} RIDES` · `{collegeShort}`.
- Overlays: shine layer (radial white 38% at the tilt point + a 105° streak white 16%, blend overlay), grain (noise 14%, overlay), and the state overlays below.

### 6.3 States

| State       | Front shows                                                                                                                                                                                                       | Status pill text                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `pending`   | content greyscale at 42% opacity; dashed-border stamp `AWAITING APPROVAL` rotated −9° at right 6u/top 31u; bottom row shows `APPLIED {time}` instead of the pass label                                            | `PENDING` (dot muted)              |
| `minting`   | plays the mint animation (§6.5) then becomes `ready`                                                                                                                                                              | `READY`                            |
| `ready`     | full colour                                                                                                                                                                                                       | `READY` (dot ok)                   |
| `riding`    | the bike code fills the chip slot (`accent` bg, `onAccent` text, mono bold 3.6u, two vertical lines like a card chip); outer glow `primary` at 55% breathing; bottom row: `FROM {fromStand}` · live timer `mm:ss` | `RIDING · {time left}` (accent bg) |
| `overdue`   | chip slot and pill in `overdue` (#FFB020 / #1F1300); glow amber; timer counts time over the limit as `+mm:ss`                                                                                                     | `OVERDUE +{time over}`             |
| `returned`  | mint-green stamp `RETURNED AT {STAND} · {N} MIN` rotated −10° at right 6u/top 18u; after 2.5 s the component's parent switches to `ready`                                                                         | `READY`                            |
| `suspended` | content blurred (1.2u) at 55%; centred red badge `SUSPENDED`                                                                                                                                                      | `SUSPENDED` (dot bad)              |

### 6.4 Back face

Shown after a tap (flip). Padding 5.5u × 6.5u; grid 38u | rest.

- Header row: kicker `SHOW THIS TO AN ADMIN` and a 9u ring countdown (circle stroke `accent`, dash 88, offset proportional to seconds left of the 30 s window).
- Left: white square (radius 3u, padding 2u) with the pass QR (`react-native-qrcode-svg`, error correction M, colour `#0B0E13`). The QR is fetched with `getMyPassQr()` when the back becomes visible and again 1 s before `expires_at`; it is never cached to disk. Pending/suspended → QR replaced by text `en.pass.no_qr`.
- Right: note text (body 3.1u): `en.pass.back_note` = "Admins scan this to see who has which bike. It changes every 30 seconds."
- Bottom stats row (4 columns, top border `line`): `RIDES {rides}`, `MINUTES {minutes}`, `FAVE {fave_stand ?? '—'}`, `STRIKES {strikes}` (number numeric 5.4u, label mono 2.1u).

### 6.5 Motion (exact)

| Moment          | Trigger                                            | Animation                                                                                                                                                                                                                                            | Haptic                                |
| --------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Idle sway       | Home visible, not touched, reduce motion off       | rotateY −8°↔8°, rotateX 3°↔−2°, shine x 22%↔78%, 7 s ease-in-out loop; stops while the device tilt is active                                                                                                                                         | —                                     |
| Tilt and shine  | device motion (expo-sensors `DeviceMotion`, 60 Hz) | rotateX = clamp((beta − beta₀) × 0.35, −10°, 10°), rotateY = clamp(gamma × 0.45, −12°, 12°), low-pass α = 0.15; shine centre follows (mx = 50% + ry × 2.5%, my = 50% − rx × 2.5%). beta₀ = beta at screen focus. Web: pointer position over the card | —                                     |
| Flip            | tap                                                | rotateY +180° over 900 ms, easing `cubic-bezier(.25,1.3,.45,1)`; faces swap at 90° (front opacity 1→0, back 0→1 instantly at the midpoint)                                                                                                           | `selection`                           |
| Mint            | pass becomes `ready` and `minted_seen_at` is null  | content revealed left→right (clip from inset right 100% to 0) 1.3 s `cubic-bezier(.6,0,.2,1)` with a white 75% sweep band crossing right→left; then `markPassMintedSeen()`                                                                           | `notificationAsync(Success)` at 0.9 s |
| Dock            | borrow succeeds                                    | bike chip drops from translateY −260%, scale 1.8, rotate −8°, opacity 0 → overshoot 8% → settle, 800 ms `cubic-bezier(.2,1.2,.4,1)`; whole card "thunk" (translateY +2.4u, scale .985, back) 500 ms starting at 450 ms                               | `impactAsync(Heavy)` at 450 ms        |
| Glow            | riding/overdue                                     | glow opacity 0.55 ↔ 0.25, 2.4 s ease-in-out loop                                                                                                                                                                                                     | —                                     |
| Stamp           | return succeeds                                    | stamp from scale 2.4, opacity 0, rotate 4° → scale 1, opacity 1, rotate −10°, 550 ms `cubic-bezier(.3,1.5,.5,1)`                                                                                                                                     | `impactAsync(Medium)` at 300 ms       |
| Finish level-up | `finish_after !== finish_before` on return         | after the stamp, the background cross-fades to the new finish over 1 s and a toast `en.pass.level_up` ("New finish unlocked: {finish}") shows                                                                                                        | `notificationAsync(Success)`          |

With reduce motion on: no sway, no tilt, no glow pulse; flip, mint, dock and stamp change instantly; haptics still fire.

### 6.6 Native implementation

- `apps/mobile/src/components/RiderPass/RiderPass.native.tsx` (+ `PassFront.tsx`, `PassBack.tsx`, `PassBackground.tsx`, `useTilt.ts`, `usePassAnimations.ts`).
- 3D: an `Animated.View` with `transform: [{ perspective: 1100 }, { rotateX }, { rotateY }]` driven by shared values. Two absolutely positioned faces; the back has an extra `rotateY: '180deg'`. Visibility is swapped by opacity at 90° (do not rely on `backfaceVisibility`, it is unreliable on Android).
- Backgrounds, holo, shine, grain and glow are drawn with `@shopify/react-native-skia` (`Canvas` sized to the card, `RoundedRect` clip, `LinearGradient`, `RadialGradient`, `FractalNoise` shader, `BlurMask` for glow) with shine position from shared values via Skia's Reanimated integration.
- Text and the chip slot are normal RN views over the canvas (so screen readers read them).
- Accessibility: the card is one accessible element with label `en.pass.a11y` = "Rider pass {passLabel}, {state words}. Double tap to flip." and the flip as the activate action.

### 6.7 Web implementation

- `RiderPass.web.tsx` renders the same structure as HTML and ports the `.pass*`, `.pf-*`, `.pb-*` rules and the keyframes `sway`, `thunk`, `dock`, `reveal`, `sweep`, `stamp`, `breathe` from `reference/ui-board.html` into `RiderPass.web.css` (imported by the component; Expo web supports CSS imports), keeping only the Ink direction, the Signal palette and the three finishes. Tilt uses pointer position (the board's `tilt()` function). The QR is rendered as SVG with `react-native-qrcode-svg` (works on web).
- The admin web app reuses the same CSS in `apps/admin/src/components/pass/RiderPassWeb.tsx` (A01 static with sway, A04 tilt on hover, A05 small and static).

## 7. Admin layout

The shell, navigation, breakpoints and table behaviour are specified in `05-admin-web.md` §1.3 and §1.6. Visual rules for the admin site:

- Sidebar and cards use `surface`, the page uses `bg`, borders are `border`; the active nav item is a `surface2` pill with the icon in `primary`.
- Content max width 1280; cards sit in a 12-column grid with 16 px gaps; card radius 22 on the admin site.
- Tables (shadcn `Table`): row height 52, sticky header, mono for codes and pass labels, `StatusPill` for statuses.
- The page title is a `Headline` (size l) with its accent word; group names are `Kicker`s.
- Demo sessions show the demo `Banner` under the top of every page.

## 8. Imagery and empty states

No stock photos. Empty states use a sticker plus a headline: e.g., no rides yet → sticker `first ride?` (yellow, −4°) + headline `your rides land *here*`. Each screen's empty copy is in its section of 04/05.
