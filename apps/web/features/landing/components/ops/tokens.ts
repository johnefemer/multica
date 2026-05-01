/**
 * AgentHost "Ops Console" Design Tokens
 * ───────────────────────────────────────────────
 * Source of truth: index.html (the Ops Console standalone landing).
 * Every value here is one that actually appears in the design.
 * Do not invent new shades / sizes / breakpoints — extend this file
 * and reference from there.
 *
 * Scope: these tokens apply ONLY inside the `.ops-landing` wrapper.
 * Nothing here is published to global Tailwind theme — components
 * either consume CSS custom properties (preferred) or the JS-side
 * `tokens` export for component-style objects (button variants, etc.).
 */

export const color = {
  bg: "#0a0d10",
  bg2: "#0f1318",
  bg3: "#12171d",

  line: "#1a2128",
  line2: "#26303a",
  line3: "#384451",

  txt: "#d4dde4",
  txt2: "#9aa6af",
  dim: "#6b7780",
  dim2: "#3d4a55",

  accent: "#7cf29c",
  accent2: "#5fd6f5",
  warn: "#f5b942",
  pop: "#ff6363",

  accentHover: "#a4f5ba",
} as const;

export const selection = { background: color.accent, foreground: color.bg } as const;

export const font = {
  family: {
    mono: `var(--font-mono-display), 'JetBrains Mono', ui-monospace, 'Menlo', monospace`,
  },

  size: {
    hero: "84px",
    heroLg: "64px",
    heroMd: "48px",
    heroSm: "42px",

    cta: "72px",
    ctaLg: "56px",
    ctaMd: "38px",
    ctaSm: "34px",

    h2: "48px",
    h2Lg: "40px",
    h2Md: "30px",

    stat: "48px",
    price: "42px",
    quote: "24px",
    quoteSm: "19px",

    h3: "24px",
    metric: "24px",
    h4: "18px",
    h5: "15px",

    lede: "14.5px",
    body: "14.5px",
    base: "14px",
    baseMobile: "13.5px",
    bodyDense: "13px",
    detail: "12.5px",
    tag: "12px",
    label: "11px",
    micro: "10.5px",
    nano: "10px",
    nanoSmall: "9.5px",
  },

  weight: {
    regular: 400,
    medium: 500,
    bold: 600,
    extrabold: 700,
  },

  lineHeight: {
    tight: 0.96,
    snug: 1.2,
    normal: 1.55,
    loose: 1.6,
    log: 1.7,
    audit: 1.95,
  },

  tracking: {
    headline: "-0.025em",
    subhead: "-0.005em",
    normal: "0",
    label: "0.18em",
    eyebrow: "0.16em",
    tag: "0.14em",
    caps: "0.12em",
    micro: "0.06em",
  },

  headlineCase: "uppercase" as const,
} as const;

export const layout = {
  containerMax: "1320px",
  containerPad: "40px",
  containerPadLg: "28px",
  containerPadMd: "16px",

  navHeight: "56px",

  sectionPad: "96px",
  sectionPadLg: "72px",
  sectionPadMd: "56px",

  heroPadY: ["64px", "48px"],
  heroPadYMd: ["36px", "32px"],

  ctaPadY: "120px",
  ctaPadYLg: "88px",
  ctaPadYMd: "64px",

  gridCell: "24px",
} as const;

export const space = {
  0: "0",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "14px",
  5: "16px",
  6: "18px",
  7: "20px",
  8: "24px",
  9: "28px",
  10: "32px",
  11: "36px",
  12: "40px",
  14: "48px",
  16: "56px",
  18: "64px",
  20: "72px",
  24: "88px",
  28: "96px",
  32: "120px",
} as const;

export const border = {
  hairline: `1px solid ${color.line}`,
  default: `1px solid ${color.line2}`,
  strong: `1px solid ${color.line3}`,
  accent: `1px solid ${color.accent}`,
  dashed: `1px dashed ${color.line}`,
  radius: {
    none: "0",
    dot: "50%",
  },
} as const;

export const glow = {
  accentDot: `0 0 12px ${color.accent}`,
} as const;

export const breakpoint = {
  xl: "1020px",
  lg: "980px",
  md2: "920px",
  md: "880px",
  sm: "760px",
  xs: "640px",
  xxs: "540px",
  mobile: "480px",
  tiny: "380px",
} as const;

export const motion = {
  duration: {
    fast: "140ms",
    base: "180ms",
    slow: "240ms",
    streamTick: "1700ms",
  },
  easing: {
    inOut: "ease-in-out",
    standard: "ease",
  },
  caret: { duration: "1s", timing: "steps(2)" },
  pulse: { duration: "2.4s", timing: "ease-in-out", min: 0.5, max: 1 },
  pulseRun: { duration: "1.4s", timing: "ease-in-out" },
} as const;

export const z = {
  nav: 50,
  drawer: 60,
} as const;

export const component = {
  button: {
    solid: {
      bg: color.accent,
      fg: color.bg,
      border: color.accent,
      bgHover: color.accentHover,
    },
    outline: {
      bg: "transparent",
      fg: color.accent,
      border: color.accent,
      bgHover: color.accent,
      fgHover: color.bg,
    },
    ghost: {
      bg: "transparent",
      fg: color.dim,
      border: color.line2,
      bgHover: color.line,
      fgHover: color.txt,
      borderHover: color.line3,
    },
    padding: "11px 18px",
    minHeight: "44px",
  },

  card: {
    bg: color.bg2,
    bgFeatured: color.bg3,
    border: color.line2,
    accentBg: `linear-gradient(180deg, rgba(124,242,156,0.04), transparent 80%)`,
    accentBorder: color.accent,
  },

  pill: {
    bg: color.bg,
    border: color.line2,
    fg: color.txt2,
    glyph: color.accent,
    glyphSecondary: color.accent2,
    glyphMuted: color.dim,
  },

  avatar: {
    bot1: { bg: color.accent, fg: color.bg },
    bot2: { bg: color.accent2, fg: color.bg },
    bot3: { bg: "#b18cf5", fg: color.bg },
    human: { bg: "transparent", fg: color.txt2, border: color.line3 },
  },

  status: {
    dispatch: color.accent,
    complete: color.accent2,
    fail: color.pop,
    warn: color.warn,
    neutral: color.dim,
  },
} as const;

export const tokens = {
  color,
  selection,
  font,
  layout,
  space,
  border,
  glow,
  breakpoint,
  motion,
  z,
  component,
} as const;

export type Tokens = typeof tokens;

export default tokens;
