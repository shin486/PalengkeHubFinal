// src/theme/tokens.js
// ============================================================
// DESIGN TOKENS - PalengkeHub
// ============================================================
// One place for colour, spacing, radius, elevation and type so
// every screen, the admin dashboard and the public site agree.
//
// Principles:
//   - The palette is derived from the basket logo and nothing else.
//     Orange #E8833A is the ring, #261006 is the outline, #E2BA87 is
//     the weave, #9EBF5C is the lettuce, #D34638 is the tomato,
//     #84BEE0 is the fish. No framework defaults.
//   - ONE brand colour on actions. Orange means "do this".
//     Red is never a primary action; it is only error and MAHAL.
//   - Surfaces separate by contrast (warm white card on woven paper),
//     not by shadow. Reach for SHADOWS only when something floats.
//   - Never hardcode a hex in a screen. If a value is missing here,
//     add a token here first.
//
// Usage:
//   import { COLORS, SPACING, RADIUS, SHADOWS, TYPE } from '../theme/tokens';
//   const c = COLORS.light;
//   card: { backgroundColor: c.card, borderRadius: RADIUS.lg, padding: SPACING.lg }
//
// Drop-in note: COLORS is shaped to replace the COLORS literal inside
// src/contexts/ThemeContext.js one for one. Every key that file exports
// today still exists here, including the legacy text aliases
// (text.dark / medium / light / lighter / white / tertiaryer), so the
// 34 screens that read them keep working. Only the VALUES changed.
// ============================================================

// ------------------------------------------------------------
// COLOURS
// ------------------------------------------------------------
export const COLORS = {
  light: {
    // brand: the logo ring orange, the only colour allowed on a CTA
    primary: '#E8833A',
    primaryLight: '#F0913F',
    primaryDark: '#C96A28',
    accent: '#F0A063',
    accentLight: '#FBE7D4',
    accentSoft: '#FDF3E9',

    // surfaces
    background: '#F2E7D6',
    surface: '#FFFDFA',
    surfaceSecondary: '#F3E3CB',
    card: '#FFFDFA',

    // ink ramp, replaces the Tailwind grey ramp
    text: {
      primary: '#261006',
      secondary: '#5B4436',
      tertiary: '#8A7263',
      quaternary: '#A89484',
      inverse: '#FFFDFA',
      // Legacy naming aliases (kept for backward compatibility with older screens)
      dark: '#261006',
      medium: '#5B4436',
      light: '#8A7263',
      lighter: '#A89484',
      white: '#FFFDFA',
      tertiaryer: '#8A7263',
    },

    border: '#E3CFB0',
    borderLight: '#EFDFC6',

    // semantic: leaf = success, tomato = error, gold = warning, fish = info
    success: '#61802F',
    successLight: '#EDF3DE',
    error: '#D34638',
    errorLight: '#FBE2DE',
    warning: '#D89A17',
    warningLight: '#FBEFD2',
    info: '#2C6C93',
    infoLight: '#E5F1F9',

    shadow: 'rgba(38, 16, 6, 0.10)',
    shadowDark: 'rgba(38, 16, 6, 0.16)',
    overlay: 'rgba(38, 16, 6, 0.50)',
    inputBg: '#F3E3CB',
    badgeBg: '#FBE2DE',
    statusBar: 'dark',

    // Screen-specific brand/surface tokens (theme-aware)
    gold: '#D89A17',
    primarySurface: '#FDF3E9',
    gcash: '#007DFE',
    gcashLight: '#E4F0FF',

    // --- added by the design system, safe to adopt gradually ---
    // texture and structure
    paper: '#F2E7D6',
    cardSecondary: '#F8F0E4',
    wicker: '#E2BA87',
    wickerSoft: '#F3E3CB',
    brandSoft: '#FBE7D4',

    // semantic fills (the lighter, decorative tone of each family)
    successFill: '#9EBF5C',
    errorFill: '#D34638',
    warningFill: '#D89A17',
    infoFill: '#84BEE0',

    // "on" pairs: the readable text colour on each solid fill.
    // These are what let the dark palette work without a second file.
    onPrimary: '#261006',   // text on primary
    inkSurface: '#261006',  // toast, banner, code block, tooltip surface
    onInk: '#F5E7D5',       // text on inkSurface
    successSolid: '#61802F',
    onSuccess: '#F7FBEF',
    onError: '#FFF6F1',

    // the price verdict, used by the MURA / KATAMTAMAN / MAHAL chips
    verdictCheapBg: '#EDF3DE',
    verdictCheapText: '#61802F',
    verdictFairBg: '#F3E3CB',
    verdictFairText: '#5B4436',
    verdictDearBg: '#FBE2DE',
    verdictDearText: '#9E2B20',
    verdictBestBg: '#61802F',
    verdictBestText: '#F7FBEF',
  },

  // Dark theme. FUTURE, NOT YET USED IN THE APP.
  // Defined so nobody has to invent it later, and so the old navy
  // (#0F0F1E / #1A1A2E / #16213E) can be deleted in one commit.
  // In dark mode a "Dark" suffix means the readable tone of that
  // family, so those values become lighter, not darker.
  dark: {
    primary: '#F0A063',
    primaryLight: '#F5B078',
    primaryDark: '#E8833A',
    accent: '#E8833A',
    accentLight: '#3A2415',
    accentSoft: '#2B1B10',

    background: '#17100A',
    surface: '#221812',
    surfaceSecondary: '#2E211A',
    card: '#221812',

    text: {
      primary: '#F7EDE1',
      secondary: '#DDC9B6',
      tertiary: '#AE9884',
      quaternary: '#8A7263',
      inverse: '#17100A',
      // Legacy naming aliases (kept for backward compatibility with older screens)
      dark: '#F7EDE1',
      medium: '#DDC9B6',
      light: '#AE9884',
      lighter: '#8A7263',
      white: '#17100A',
      tertiaryer: '#AE9884',
    },

    border: '#3D2C22',
    borderLight: '#2A1E17',

    success: '#C3DE8E',
    successLight: '#28331A',
    error: '#F0968C',
    errorLight: '#3A1C18',
    warning: '#F0CB77',
    warningLight: '#33270D',
    info: '#AFD8EF',
    infoLight: '#152833',

    shadow: 'rgba(0, 0, 0, 0.45)',
    shadowDark: 'rgba(0, 0, 0, 0.65)',
    overlay: 'rgba(10, 6, 3, 0.66)',
    inputBg: '#2E211A',
    badgeBg: '#3A1C18',
    statusBar: 'light',

    gold: '#E5B23F',
    primarySurface: '#2B1B10',
    gcash: '#3D9BFF',
    gcashLight: '#132A42',

    paper: '#17100A',
    cardSecondary: '#2E211A',
    wicker: '#4A362A',
    wickerSoft: '#2E211A',
    brandSoft: '#3A2415',

    successFill: '#A9C96C',
    errorFill: '#E8695C',
    warningFill: '#E5B23F',
    infoFill: '#8FC6E6',

    onPrimary: '#17100A',
    inkSurface: '#F7EDE1',
    onInk: '#17100A',
    successSolid: '#C3DE8E',
    onSuccess: '#17100A',
    onError: '#2A100C',

    verdictCheapBg: '#28331A',
    verdictCheapText: '#C3DE8E',
    verdictFairBg: '#2E211A',
    verdictFairText: '#DDC9B6',
    verdictDearBg: '#3A1C18',
    verdictDearText: '#F0968C',
    verdictBestBg: '#C3DE8E',
    verdictBestText: '#17100A',
  },
};

// ------------------------------------------------------------
// ORDER STATUS
// ------------------------------------------------------------
// Same labels and same meanings as customerTheme.js / vendorTheme.js
// today, re-tuned to this palette. Import this instead of keeping two
// divergent copies (the old pair disagreed on `preparing` in dark mode).
export const ORDER_STATUS = {
  light: {
    pending: '#D89A17',
    accepted: '#2C6C93',
    confirmed: '#2C6C93',
    preparing: '#C96A28',
    ready: '#61802F',
    paid: '#61802F',
    verified: '#61802F',
    completed: '#8A7263',
    cancelled: '#D34638',
    rejected: '#D34638',
    expired: '#A89484',
  },
  dark: {
    pending: '#F0CB77',
    accepted: '#AFD8EF',
    confirmed: '#AFD8EF',
    preparing: '#F0A063',
    ready: '#C3DE8E',
    paid: '#C3DE8E',
    verified: '#C3DE8E',
    completed: '#AE9884',
    cancelled: '#F0968C',
    rejected: '#F0968C',
    expired: '#8A7263',
  },
};

// ------------------------------------------------------------
// SPACING
// ------------------------------------------------------------
// One 4px scale. Replaces customerSpacing and vendorSpacing, which
// disagreed from xl upward. The tighter (vendor) values win.
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,   // the default gap and the default screen gutter
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Bars, tab items and count badges are denser than page content.
// Use this instead of declaring a local SPACING inside a nav component.
export const NAV_SPACING = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
};

// ------------------------------------------------------------
// RADIUS
// ------------------------------------------------------------
// Twenty radii ship in the app today. Six here, and three do the work:
// sm on chips and in-card buttons, md on thumbs and rows, lg on cards.
export const RADIUS = {
  xs: 6,     // kbd, code, tiny badges
  sm: 10,    // chips, verdict chips, discount badges, in-card buttons
  md: 12,    // inputs, thumbnails, list rows
  lg: 16,    // every card and panel
  xl: 22,    // bottom sheets, modals
  full: 999, // pills, avatars, the primary CTA
};

// ------------------------------------------------------------
// SHADOWS
// ------------------------------------------------------------
// One convention only: a solid shadowColor plus a fractional
// shadowOpacity, never `shadowColor: 'rgba(...)'` with opacity 1.
// Spread these into a style: { ...SHADOWS.float }
// Level 0 is the default. Cards separate from the page by contrast.
export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  hairline: {
    shadowColor: '#261006',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  float: {
    // floating buttons, dropdowns, the back-to-top control
    shadowColor: '#261006',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 4,
  },
  overlay: {
    // modals, bottom sheets
    shadowColor: '#261006',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
  bar: {
    // bottom tab bar and sticky action bar, shadow points upward
    shadowColor: '#261006',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
};

// The signature press affordance: the primary button carries a solid
// 3px offset in primaryDark instead of a blur, and sinks on press.
// On React Native build it with a borderBottomWidth, not a shadow.
export const PRESS_OFFSET = {
  height: 3,
  color: COLORS.light.primaryDark,
};

// ------------------------------------------------------------
// TYPOGRAPHY
// ------------------------------------------------------------
// Baloo 2 carries the brand voice: headings, stall names, prices.
// Nunito carries everything a shopper reads quickly.
//
// fontFamily activates once expo-font is added. Until then every
// value below falls back to the platform default, which is what the
// app already renders, so adopting TYPE.size and TYPE.weight now is
// safe and changes nothing visually.
//
//   expo install expo-font @expo-google-fonts/baloo-2 @expo-google-fonts/nunito
//   then swap the two `system` strings for 'Baloo2_700Bold' etc.
export const TYPE = {
  family: {
    display: 'system',  // Baloo 2 once expo-font is added
    ui: 'system',       // Nunito once expo-font is added
    mono: 'monospace',  // platform monospace, no webfont is shipped
  },

  size: {
    priceHero: 38,  // product detail price
    display: 26,    // screen title on a detail view
    h1: 22,         // greeting, sheet title
    h2: 19,         // section heading
    h3: 17,         // stall name, card title
    body: 16,       // default. Inputs must never go below this on iOS.
    bodySmall: 15,
    label: 14,
    caption: 13,
    micro: 12,      // uppercase chips and tab labels only
  },

  weight: {
    regular: '400',
    medium: '600',
    semibold: '700',  // default UI text
    bold: '800',      // headings and labels
    black: '900',     // prices and CTAs
  },

  lineHeight: {
    tight: 1.15,   // display sizes
    snug: 1.25,    // card titles
    base: 1.45,    // body
    relaxed: 1.6,  // long-form paragraphs
  },

  letterSpacing: {
    price: -0.4,  // large numerals tighten
    normal: 0.1,
    caps: 0.5,    // uppercase chips and labels
  },
};

// Ready-made text styles, so a screen never assembles its own.
export const TEXT_STYLES = {
  priceHero: { fontSize: TYPE.size.priceHero, fontWeight: TYPE.weight.black, letterSpacing: TYPE.letterSpacing.price },
  price: { fontSize: TYPE.size.h2, fontWeight: TYPE.weight.black, letterSpacing: -0.3 },
  h1: { fontSize: TYPE.size.h1, fontWeight: TYPE.weight.bold },
  h2: { fontSize: TYPE.size.h2, fontWeight: TYPE.weight.bold },
  h3: { fontSize: TYPE.size.h3, fontWeight: TYPE.weight.bold },
  body: { fontSize: TYPE.size.body, fontWeight: TYPE.weight.medium },
  bodySmall: { fontSize: TYPE.size.bodySmall, fontWeight: TYPE.weight.medium },
  label: { fontSize: TYPE.size.label, fontWeight: TYPE.weight.bold },
  caption: { fontSize: TYPE.size.caption, fontWeight: TYPE.weight.semibold },
  chip: { fontSize: TYPE.size.micro, fontWeight: TYPE.weight.black, letterSpacing: TYPE.letterSpacing.caps, textTransform: 'uppercase' },
};

// ------------------------------------------------------------
// LAYOUT CONSTANTS
// ------------------------------------------------------------
// The few fixed sizes the shell depends on. Everything else derives
// from SPACING.
export const LAYOUT = {
  tabBarHeight: 64,      // plus the safe-area inset
  headerMinHeight: 56,
  searchHeight: 50,
  searchHeightScrolled: 44,
  minTapTarget: 44,      // never ship a control smaller than this
  borderWidth: 2,        // the system border is 2px, hairlines are 1px
  hairlineWidth: 1,
  screenGutter: SPACING.lg,
};
