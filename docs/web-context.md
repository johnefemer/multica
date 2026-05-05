# Development Context — Agenthost Web App

> **Primary audience:** Claude Code (or any engineer) tasked with porting the standalone `index.html` "Ops Console" landing concept into the existing `web/` Next.js app at `web/app/(landing)/`. **§§1–12 cover this.**
>
> **Secondary audience:** anyone touching the **integrations page** (`/[workspace]/integrations`) or wiring inbound webhook surfaces. **§13 covers Slack + GitHub.** It's separate from the landing port — read it in isolation if integrations are your only concern.
>
> **Output of the landing-port task:** a new landing variant (or a swap of the current one) that preserves the visual DNA of `index.html` but is implemented natively as React Server / Client Components inside the existing app, fully wired to i18n, auth, theming, and routing conventions.
>
> **Companion docs:**
> - `CONTEXT.md` — product/brand voice (landing copy gaps).
> - `index.html` — the landing design source.
> - `web/features/landing/` — current landing implementation.
> - [docs/slack-integration.md](./slack-integration.md) — Slack v1 design (§13 pointers).
> - [docs/agenthost-releasing.md](./agenthost-releasing.md) — backend deploy + integration env-var setup.

---

## 1. What you are porting

`index.html` is a single-file, ~1100-line static landing concept titled **"AgentHost — control plane for AI-augmented engineering teams"**. It is one of three explored aesthetic directions and has been chosen to evaluate against the current production landing.

**Visual DNA:**
- **Aesthetic:** "Ops Console" — terminal-monochrome, JetBrains Mono throughout, dense grid lines, 13px base, uppercase tracked labels, monospaced numerals.
- **Palette:** dark only (`--bg #0a0d10`, `--bg2 #0f1318`, `--bg3 #12171d`); single accent green `--accent #7cf29c`, secondary cyan `#5fd6f5`, warn `#f5b942`, pop red `#ff6363`, four greys (`--txt`, `--txt2`, `--dim`, `--dim2`).
- **Layout primitives:** sticky top nav (56px), 1320px max container, 96px section padding, hard 1px borders (no rounded corners except dots), `//` and `→` as functional ornament.
- **Type:** monospace everywhere, 84px hero (`text-transform:uppercase`, `letter-spacing:-0.025em`, `line-height:0.96`), 48px section heads, 24px sub-heads, 13px body, 10–11px tracked labels.
- **Motion:** caret blink, status-dot pulse, live stream feed (1.7s tick), interactive workflow stepper (5 frames).

**Sections, in order:**
1. Sticky nav (brand · product/workflow/compare/pricing/docs/changelog · status pill · CTA)
2. Hero (eyebrow build tag · uppercase headline with green/dim color split · lede · CTA row · 4-cell metrics strip · right column: live sprint queue panel + streaming `tail -f` panel)
3. `§01 PROPOSITION` — two-column without/with comparison
4. `§02 PRIMITIVES` — 6-card pillar grid (Identity / Runtime / Skills / Autopilot / Memory / Inbox)
5. `§03 THE_LOOP` — interactive 5-step workflow w/ frame canvas + ASCII diagram
6. `§04 NUMBERS` — 4-cell stats strip
7. `§05 VS_REST` — 4-column compare matrix vs issue trackers / agent IDEs
8. Quote
9. `§06 PRICING` — 3 tiers (Self Host / Cloud / Enterprise)
10. CTA panel
11. Footer (5-column links, brand block, build/license/version meta)

The two **interactive** pieces are non-negotiable:
- **Stream feed:** appends a new row every 1.7s, keeps last 7 rows.
- **Workflow stepper:** clicking a step swaps the right-panel frame content + label. Five frame templates.

---

## 2. Where it lands in the codebase

The Next.js app is at `web/`. Landing routes live under the `(landing)` route group:

```
web/
├── app/
│   ├── (landing)/
│   │   ├── layout.tsx            ← serif fonts + JSON-LD + LocaleProvider + .landing-light
│   │   ├── page.tsx              ← / (currently renders <AgenthostLanding />)
│   │   ├── about/page.tsx
│   │   ├── changelog/page.tsx
│   │   ├── download/...
│   │   └── homepage/page.tsx
│   ├── globals.css               ← tailwind + tw-animate-css + shadcn + tokens + custom.css
│   └── custom.css                ← .landing-light light-token override
├── features/landing/
│   ├── components/
│   │   ├── agenthost-landing.tsx ← composition root (currently 7 children)
│   │   ├── landing-header.tsx    ← dark/light variant header
│   │   ├── landing-hero.tsx      ← current hero (serif headline, photo bg)
│   │   ├── features-section.tsx  ← scroll-jacked left-nav + sticky visuals (~1100 lines)
│   │   ├── how-it-works-section.tsx
│   │   ├── open-source-section.tsx
│   │   ├── faq-section.tsx
│   │   ├── landing-footer.tsx    ← dark footer + giant lowercase logo
│   │   └── shared.tsx            ← icons (Claude/Codex/Gemini/OpenClaw/OpenCode), btn class helpers
│   ├── i18n/
│   │   ├── context.tsx           ← LocaleProvider, useLocale()
│   │   ├── types.ts              ← LandingDict shape (CANONICAL — extend it)
│   │   ├── en.ts / zh.ts         ← createEnDict(allowSignup) / createZhDict(allowSignup)
│   │   └── index.ts
│   └── utils/...
└── ...
```

**Decision: where this lands.**

Recommended path (default): add a new component tree under `features/landing/components/ops/` and a new route `app/(landing)/ops/page.tsx` that renders it. Keep the current `<AgenthostLanding/>` at `/` untouched until the variant is approved. Both can coexist behind feature flags or as A/B routes.

If the user explicitly says "replace the current one," wire the new tree into `agenthost-landing.tsx` instead and leave the old components in place but unused (do not delete them in the same PR).

---

## 3. Stack & conventions to match

| Concern | Convention |
|---|---|
| **Framework** | Next.js 16 (App Router). Use Server Components by default; mark `"use client"` only when you need state, refs, or `useEffect`. |
| **Styling** | Tailwind v4 (CSS-first config) + shadcn token layer. Project uses `cn()` from `@multica/ui/lib/utils`. **No styled-components, no CSS modules, no inline `<style>` tags.** |
| **Tokens** | Semantic tokens (`bg-background`, `text-foreground`, `border`, `text-muted-foreground`, `bg-accent`, `text-info`, `text-success`, `text-destructive`). The `.landing-light` wrapper on `(landing)/layout.tsx` pins the tree to light tokens. |
| **Fonts** | `next/font/google`. Current layout loads `Instrument_Serif` (`--font-serif`) + `Noto_Serif_SC` (`--font-serif-zh`). **You will add `JetBrains_Mono` as `--font-mono-display`** (see §5). |
| **Icons** | `lucide-react`. Custom brand glyphs live in `features/landing/components/shared.tsx` (GitHubMark, ClaudeCodeLogo, CodexLogo, GeminiCliLogo, OpenClawLogo, OpenCodeLogo). Reuse these — do not redraw them. |
| **Routing** | `next/link` for internal nav. External links: `<Link target="_blank" rel="noreferrer">`. `githubUrl` constant from `shared.tsx` (`https://github.com/johnefemer/multica`). |
| **Auth** | `useAuthStore` from `@multica/core/auth`. Current pattern: `const user = useAuthStore((s) => s.user);` then `href={user ? "/" : "/login"}` and label flips between `t.header.dashboard` and `t.header.login`/`t.hero.cta`. **Always include `<RedirectIfAuthenticated />` at the top of the page component** (it's the existing pattern in `app/(landing)/page.tsx`). |
| **i18n** | `useLocale()` from `features/landing/i18n`. Returns `{ t, locale, setLocale }`. Every user-visible string MUST come from `t.*`. Extend `LandingDict` in `types.ts` first, then add EN+ZH copy in `en.ts` / `zh.ts`. |
| **Imports** | `@/` → `web/`. Cross-package: `@multica/core/*`, `@multica/ui/*`, `@multica/views/*`. Workspace-pinned in `package.json` (`workspace:*`). |
| **Tests** | Vitest. Co-locate `*.test.ts(x)` next to source. Existing example: `features/landing/utils/github-release.test.ts`. |
| **Lint/types** | `pnpm typecheck`, `pnpm lint`, `pnpm test`. Must all pass. |

---

## 4. The mapping table — index.html → React tree

Every section in `index.html` maps to one client/server component. Defaults below; adjust if obvious.

| index.html section | New component | Server/Client | Notes |
|---|---|---|---|
| `<nav class="top">` | `OpsHeader` | client | Reads `useAuthStore`, `useLocale`. Sticky, blur, status pill, CTA. |
| `<header class="hero">` | `OpsHero` | client | Two-column. Left = headline+lede+CTA+meta strip. Right = `OpsSprintQueue` + `OpsStreamFeed`. |
| Hero right `tail -f` panel | `OpsStreamFeed` | client | `useEffect` interval. **Use `useReducer` or `useState` with stable seed**, and **gate the interval behind a mounted flag** to avoid hydration mismatch. |
| `§01 PROPOSITION` | `OpsProposition` | server | Pure JSX from dict. Two side-by-side cards, the second has the green border treatment. |
| `§02 PRIMITIVES` | `OpsPillars` | server | 6 cards in a 3-col grid (2-col @ md, 1-col @ sm). Inline SVG glyphs (lift them verbatim from `index.html`). |
| `§03 THE_LOOP` | `OpsWorkflow` | client | Stepper state. Five frame templates as a `Record<number, ReactNode>` or a `[ReactNode, …]` tuple. |
| `§04 NUMBERS` | `OpsStats` | server | Pure data from `t.stats`. 4-cell strip. |
| `§05 VS_REST` | `OpsCompare` | server | 4-column table. Use `●`/`◐`/`○` glyphs from index.html — keep them as text, not icons. |
| Quote section | `OpsQuote` | server | Single block. Pull-quote glyph, attribution, role. |
| `§06 PRICING` | `OpsPricing` | server | 3 tiers. Middle is `featured`. CTA on each. |
| Final CTA | `OpsCallToAction` | client | Reads `useAuthStore` for the primary button label/href. |
| Footer | `OpsFooter` | client | Reuses the existing `LandingFooter` pattern (locale switcher, link groups). |

**Composition root:** `features/landing/components/ops/ops-landing.tsx`:

```tsx
"use client";
export function OpsLanding() {
  return (
    <div className="font-[family-name:var(--font-mono-display)] bg-[#0a0d10] text-[#d4dde4]">
      <OpsHeader />
      <OpsHero />
      <OpsProposition />
      <OpsPillars />
      <OpsWorkflow />
      <OpsStats />
      <OpsCompare />
      <OpsQuote />
      <OpsPricing />
      <OpsCallToAction />
      <OpsFooter />
    </div>
  );
}
```

---

## 5. Required infra changes (do these first)

### 5.1 Add JetBrains Mono to the landing layout

Edit `web/app/(landing)/layout.tsx`:

```ts
import { Instrument_Serif, Noto_Serif_SC, JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono-display",
});

// then add jetbrainsMono.variable to the wrapper className:
<div className={`${instrumentSerif.variable} ${notoSerifSC.variable} ${jetbrainsMono.variable} landing-light ...`}>
```

The Ops landing tree opts into mono via `font-[family-name:var(--font-mono-display)]` on its root. Existing serif/photo landing is unaffected.

### 5.2 Decide on dark surface inside `.landing-light`

The Ops design is dark-only and the landing layout currently forces `.landing-light` (light tokens). Options, in order of preference:

1. **Hardcoded hex/oklch on the Ops tree.** Don't touch tokens. Use literal colors (`bg-[#0a0d10]`, `text-[#d4dde4]`, `border-[#1a2128]`). Matches how the current dark hero in `landing-hero.tsx` already does it (`bg-[#05070b]`).
2. Route-scoped opt-out: `app/(landing)/ops/layout.tsx` that re-applies dark tokens. Heavier; only do this if shadcn primitives (Popover, Command, etc.) are reused inside the design and need dark token resolution.

**Default to option 1** unless you find yourself needing shadcn primitives in the dark surface.

### 5.3 Define the color literal table once

Add `features/landing/components/ops/tokens.ts`:

```ts
export const OPS = {
  bg:    "#0a0d10",
  bg2:   "#0f1318",
  bg3:   "#12171d",
  line:  "#1a2128",
  line2: "#26303a",
  line3: "#384451",
  txt:   "#d4dde4",
  txt2:  "#9aa6af",
  dim:   "#6b7780",
  dim2:  "#3d4a55",
  accent:  "#7cf29c",
  accent2: "#5fd6f5",
  warn:    "#f5b942",
  pop:     "#ff6363",
} as const;
```

Reference via Tailwind arbitrary values: `bg-[var(--ops-bg)]` after declaring them on the tree's root, OR via `style={{ background: OPS.bg }}` for one-offs. Pick one approach and stay consistent — recommend CSS custom properties on the tree root so Tailwind classes stay terse.

```tsx
<div style={{
  "--ops-bg": OPS.bg, "--ops-accent": OPS.accent, /* ... */
} as React.CSSProperties}>
```

### 5.4 The grid background

```css
background-image:
  linear-gradient(var(--ops-line) 1px, transparent 1px),
  linear-gradient(90deg, var(--ops-line) 1px, transparent 1px);
background-size: 24px 24px;
background-attachment: fixed;
```

Apply to a fixed-position pseudo-element inside `OpsLanding` so it doesn't scroll-jank with `background-attachment: fixed` on iOS. Or just put it on `body` via a `globals.css` class scoped to `body[data-route="ops"]`. **Simplest:** an absolutely-positioned `<div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundImage: …, backgroundSize: "24px 24px" }} />` inside the Ops root.

---

## 6. i18n — extend `LandingDict`

Every string in `index.html` must round-trip through the dict. Add to `web/features/landing/i18n/types.ts`:

```ts
export type LandingDict = {
  // ...existing fields stay...
  ops?: {
    nav: { product: string; workflow: string; compare: string; pricing: string; docs: string; changelog: string; statusOnline: string; statusRuntimes: string; cta: string };
    hero: {
      eyebrow: { build: string; version: string; date: string };
      headlineLine1: string; headlineLine2: string; headlineLine3: string;  // "ASSIGN" / "TICKETS_to_" / "[AGENTS]"
      lede: string;             // markdown-lite, see below
      ctaPrimary: string; ctaSecondary: string; ctaMeta: string;
      meta: { codingClis: { k: string; v: string; n: string }; firstPr: { k: string; v: string; n: string }; automated: { k: string; v: string; n: string }; deploy: { k: string; v: string; n: string } };
      sprintHeader: string; sprintCount: string;
      sprintRows: { id: string; title: string; avatar: string; avatarTone: "bot" | "bot2" | "bot3" | "h"; status: "RUN" | "REV" | "DONE" | "OPEN" }[];
      streamHeader: string;
    };
    proposition: { label: string; num: string; headlineParts: string[]; sub: string; without: { ptitle: string; h: string; items: { b: string; s: string }[] }; with: { ptitle: string; h: string; items: { b: string; s: string }[] } };
    pillars: { label: string; num: string; headlineParts: string[]; sub: string; cards: { num: string; title: string; body: string; tag: string }[] };
    workflow: { label: string; num: string; headlineParts: string[]; sub: string; steps: { stepnum: string; h: string; p: string }[] };  // 5 entries
    stats: { label: string; num: string; headlineParts: string[]; sub: string; cells: { k: string; v: string; suffix?: string; n: string }[] };  // 4 entries
    compare: { label: string; num: string; headlineParts: string[]; sub: string; head: { trackers: string; ides: string; us: string }; rows: { feature: string; trackers: { kind: "yes"|"no"|"partial"; label: string }; ides: { kind: "yes"|"no"|"partial"; label: string }; us: { kind: "yes"|"no"|"partial"; label: string } }[] };
    quote: { body: string; highlight: string; by: { name: string; role: string; company: string; humans: string; agents: string } };
    pricing: { label: string; num: string; headlineParts: string[]; sub: string; tiers: { name: string; amount: string; amountSuffix: string; isFeatured?: boolean; desc: string; features: string[]; cta: string; href: string }[] };
    cta: { headlineParts: string[]; body: string; primary: string; secondary: string; tertiary: string; meta: { build: string; license: string; runtime: string; status: string; contact: string; repo: string } };
  };
};
```

> The `headlineParts: string[]` shape lets translators rearrange uppercase fragments around a fixed color split (e.g. `["SIX IDEAS.", "ONE_SYSTEM."]` where the second part renders in `--accent`). Don't bake the split into the English copy.

Then implement `ops` in `en.ts` (lift verbatim from `index.html`) and `zh.ts` (start as English fallback, mark for translation). The `?` makes it optional during rollout — remove the `?` once both locales are filled.

**Lede and bolded inline runs:** the index.html lede contains `<b>` and `<span class="hl">` runs. Don't render HTML from translation strings. Either:
- Split into `lede: { intro: string; bold: string; mid: string; highlight: string; tail: string }`, or
- Use a simple template tag e.g. `lede: "...{bold:control plane...}{hl:Local daemons...}..."` parsed by a small `<RichText>` component.

Pick one and stick with it. The split-fields approach is simpler and easier for translators.

---

## 7. Component-by-component porting notes

### 7.1 `OpsHeader`

- Sticky `top-0`, `backdrop-blur`, `bg-[rgba(10,13,16,0.85)]`, `border-b border-[#26303a]`.
- Brand: 10px green square with the existing `pulse` keyframe. Either reuse `tw-animate-css`'s built-in pulse or define a local `@keyframes` in a `<style jsx global>` — actually no, in Next.js do it in a global stylesheet (`features/landing/components/ops/ops.css`, imported once from the root component) since `<style jsx>` is not configured.
- Active link state: bottom underline aligned to the nav baseline (`bottom: -19px` in source). Use Next.js `usePathname()` for cross-page; for same-page anchors track via `IntersectionObserver` (the existing `features-section.tsx` is the template — copy the pattern).
- Status pill is decorative — keep numbers in the dict (not hardcoded).
- CTA button reuses the **same auth pattern** as `landing-header.tsx`:
  ```tsx
  const user = useAuthStore((s) => s.user);
  href={user ? "/" : "/login"}
  ```

### 7.2 `OpsHero`

- 84px headline. Don't shrink it on smaller screens until ≤760px (matches source).
- The colored split in the headline (`<span class="gt">`, `<span class="dim">`, `<span class="br">`) is achieved by rendering each fragment as its own span with a tone class. Don't use `dangerouslySetInnerHTML`.
- Metrics strip: 4 cells with hard borders. The `<small>` after each `v` is the accent suffix.
- Right column: `OpsSprintQueue` (static 5-row board) + `OpsStreamFeed` (live tail).

### 7.3 `OpsStreamFeed` (the most fragile piece)

- The source uses `setInterval(pushLine, 1700)` and trims to 7 rows.
- **In React, do NOT mutate DOM directly.** Use state:
  ```tsx
  const [lines, setLines] = useState<Line[]>(() => FEED.slice(0, 5));
  useEffect(() => {
    const id = setInterval(() => {
      setLines((prev) => {
        const next = [...prev, FEED[(prev.length) % FEED.length]];
        return next.slice(-7);
      });
    }, 1700);
    return () => clearInterval(id);
  }, []);
  ```
- **SSR/hydration:** the initial 5 rows must be deterministic (no `Math.random`, no `Date.now()`). The timestamp strings are baked into `FEED` so this is fine.
- Honor `prefers-reduced-motion`: if the user prefers reduced motion, render all 7 rows statically and skip the interval. Use `useReducedMotion`-style hook or `window.matchMedia`.

### 7.4 `OpsWorkflow`

- 5 steps, click-to-activate. Active step gets a 2px green left bar.
- The right canvas swaps content based on `activeStep`. Frames in source are HTML strings — port them as React fragments.
- The ASCII diagram block: render in `<pre>` with `font-mono` and `whitespace-pre`. It's already mono-aligned in source.
- Do not auto-advance. User-driven only.

### 7.5 `OpsCompare`

- Use a real `<table>` with semantic `<thead>`/`<tbody>` (better a11y than the source's div grid). Style it to look identical with `border-separate border-spacing-0` + Tailwind border utilities.
- Glyphs (`●`, `◐`, `○`) are content, not decoration. Keep them in the cell text. Color via the `kind` discriminator.

### 7.6 `OpsPillars`

- Inline SVGs from the source — keep them as React JSX with `aria-hidden`.
- Hover effect (`background → bg3`, glyph border → accent): pure CSS, no JS.
- The `:nth-child` border resets for the 3-column grid — translate to Tailwind with `[&:nth-child(3n)]:border-r-0` etc.

### 7.7 `OpsCallToAction`

- 72px headline, smaller meta panel on the right.
- Three CTAs: primary (solid), ghost, ghost-dim. Reuse a single `<OpsButton tone="solid"|"outline"|"ghost">` component for the page. Roll your own — the existing `heroButtonClassName` in `shared.tsx` is for the serif design and uses different proportions.

### 7.8 `OpsFooter`

- Five columns + brand block. The source's locale switcher isn't present; **keep the existing locale switcher** from `landing-footer.tsx` — it's the only way users change language and removing it breaks the ZH route.
- Build/license/version meta: read from a single source of truth. Add to dict (`t.ops.cta.meta`) and reuse here. **Do not duplicate** "v0.9.4 · 2026-05-01" in two places.

---

## 8. Things to be careful of

1. **`scrollIntoView` is OK in `features-section.tsx` because it's user-initiated.** Match that pattern. Never call it on mount.
2. **`background-attachment: fixed` + iOS Safari = jank.** Use a fixed-positioned grid `<div>` instead of CSS attachment.
3. **`useEffect` interval cleanup.** Always return the clear function. The stream feed component is the easiest place to leak.
4. **Hydration:** any time-of-day, randomized, or client-only value must be set inside `useEffect`. The existing `RuntimesVisual` in `features-section.tsx` is a good reference (note its `useEffect(() => setHeatmapCells(buildHeatmapCells()), [])` pattern).
5. **`<a>` vs `next/link`.** Always `next/link` for in-app routes. External: regular `<Link>` with `target/rel`.
6. **No emoji, no gradient SaaS clichés** (per `CONTEXT.md` §12). The Ops design has none — keep it that way during translation.
7. **Shadcn primitives** (Popover, DropdownMenu) inside dark surfaces with `.landing-light` will resolve light tokens. If you reuse one, scope a dark wrapper or stick to plain elements.
8. **Speakers/animation-starters from the static repo are not present here** — don't reach for `deck_stage.js` or `tweaks-panel.jsx`. This is a Next.js app, not an artifact.
9. **JSON-LD already handled** in `(landing)/layout.tsx`. Don't duplicate it on the page.
10. **`metadata` export** in `app/(landing)/ops/page.tsx` must be set (title + description + OG). Mirror the pattern in `app/(landing)/page.tsx`.

---

## 9. Suggested PR sequence

1. **PR 1 — infra:**
   - Add JetBrains Mono to landing layout.
   - Add `OPS` token table.
   - Create `app/(landing)/ops/page.tsx` rendering a placeholder `<OpsLanding>` (just the dark grid + a `<h1>`).
   - Verify `pnpm typecheck && pnpm lint && pnpm test`.

2. **PR 2 — i18n scaffolding:**
   - Extend `LandingDict` in `types.ts`.
   - Add `ops` block to `en.ts` (verbatim from `index.html`).
   - Add `ops` block to `zh.ts` (English fallback, marked TODO).

3. **PR 3 — static sections:**
   - `OpsHeader`, `OpsProposition`, `OpsPillars`, `OpsStats`, `OpsCompare`, `OpsQuote`, `OpsPricing`, `OpsFooter`.
   - All server components except header/footer.
   - Visual diff against `index.html` at 1320px and 768px.

4. **PR 4 — dynamic sections:**
   - `OpsHero` (with `OpsSprintQueue` + `OpsStreamFeed`).
   - `OpsWorkflow` (stepper + frames).
   - `OpsCallToAction`.
   - Reduced-motion path.

5. **PR 5 — polish & adoption:**
   - A11y audit (table semantics in compare, focus rings, aria-current on nav, prefers-reduced-motion).
   - Lighthouse pass (LCP target ≤ 2.5s; the live feed must not block paint).
   - Decide: replace `/` or keep `/ops` as a separate route. If replacing, swap the import in `app/(landing)/page.tsx` and leave the old components in `features/landing/components/` for one release cycle, then delete in a follow-up.

---

## 10. Acceptance checklist

Before requesting review:

- [ ] `pnpm typecheck` clean.
- [ ] `pnpm lint` clean.
- [ ] `pnpm test` passes.
- [ ] Page renders at `/ops` (or wherever wired) with no console errors.
- [ ] No hydration warnings in dev console.
- [ ] All copy comes from `t.ops.*` — no inline English strings outside the dict.
- [ ] Auth-aware CTAs flip label and href when logged in.
- [ ] Header active-link indicator updates as you scroll between sections.
- [ ] Stream feed appends a row every ~1.7s, capped at 7 rows, and stops when the user enables reduced motion.
- [ ] Workflow stepper swaps frame content on click; no auto-advance.
- [ ] At ≤760px viewport: nav links collapse, hero headline shrinks to 54px, grids collapse to 1-col where source does.
- [ ] Locale switcher in footer flips EN ↔ ZH and the page re-renders without route change.
- [ ] `metadata` export on the page sets title, description, and canonical URL.
- [ ] No `dangerouslySetInnerHTML` anywhere in the new code.
- [ ] No new `package.json` deps unless explicitly justified (the design uses zero JS libs — keep it that way).

---

## 11. Out of scope (do not do these without asking)

- Translating the `ops` block to Chinese. Add as a TODO; the maintainer will localize.
- Replacing the existing `/` landing. Default behaviour is to ship `/ops` as a separate route until A/B'd.
- Adding analytics events beyond what `pageview-tracker.tsx` already provides.
- Touching `features/landing/components/features-section.tsx` or any other current component. The Ops tree lives in its own folder.
- Animating the workflow stepper to auto-advance. User-driven only.
- Adding a desktop-download CTA inside the Ops hero. The download flow is at `/download` — link to it, don't inline.

---

## 12. Responsive requirements (audit-derived — non-negotiable)

The standalone `index.html` was audited at 375 / 480 / 760 / 920 / 1020 / 1320 widths and **fixed in place** — the file you're porting from already reflects these rules. When porting to React, **preserve every breakpoint and rule below**; do not regress to the pre-audit values.

### 12.1 Breakpoint ladder

The Ops design uses four breakpoints, in this order:

| BP | Triggers |
|---|---|
| `≤1020px` | Hide `.nav-links` + `.status-pill`, show burger + drawer. Drop `h1.hero-h` to 64px, `.cta h2` to 56px, `.sec-h` to 40px. Drop `section` padding to 72px. `.cta` padding to 88px. `.container` padding to 28px. |
| `≤920px` | `.flow` collapses to 1 column. |
| `≤880px` | `.twocol`, `.pricing`, `.foot-grid` collapse. `.price.featured::after` ("// RECOMMENDED") goes inline. Brand cell in footer spans full row. |
| `≤760px` | `h1.hero-h` 48px, `.cta h2` 38px, `.sec-h` 30px. `section` padding 56px. `.cta` padding 64px. `.hero` padding 36px/32px. `.container` padding 16px. Body font 13.5px. `.col-card` padding 22px/20px. `.flow-canvas` padding 20px, min-height 380px. `.quote q` 19px. Matrix cells 11.5px. Hero meta becomes 2-col. |
| `≤640px` | `.pillars` to 1 column. `.ascii` workflow diagram **hidden** (it's 60+ chars wide and forces overflow). |
| `≤540px` | `.matrix` becomes horizontally-scrollable with `min-width:510px` — readable cells beat squashed ones. |
| `≤480px` | `.foot-grid` to 1 column. `.stream-row` drops timestamp column, allows wrap. `.board-row` drops avatar column, allows title wrap. |
| `≤380px` | `h1.hero-h` 42px, `.cta h2` 34px (small phones). |

### 12.2 Type-size floor

The original design used a 13px monospace base with 10–12.5px secondary text. The audit raised these because mono renders ~1px smaller-than-equivalent-proportional for the eye:

| Element | Before | After (current) |
|---|---|---|
| `body` | 13px | **14px** (13.5 on ≤760) |
| `.col-card .li b` | 13px | **13.5px** |
| `.col-card .li span` | 12.5px | **13px** |
| `.pillar p` | 12.5px | **13px** |
| `.flow-step p` | 12.5px | **13px** |
| `.stream-row` | 11.5px | **12px** |
| `.board-row` | 12px | **12.5px**, `.id` raised to 11px |
| `.eyebrow` | 10.5px @ .22em | **11px @ .18em** (less wrap-prone) |
| `.foot ul` | 12px | **13px** |
| `.foot .desc` | 11.5px | **12.5px** |
| `.foot-bottom` | 10.5px | **11px** |
| `.sec-sub` | 14px | **14.5px** |

**When porting, do not re-baseline back down.** If you find a Tailwind utility doesn't go to 13.5px, write the literal `text-[13.5px]` — don't round.

### 12.3 Tap targets

- `.btn` was `padding:9px 16px` (~37px tall). Now `padding:11px 18px` + `min-height:44px`. Honor the 44px minimum on every clickable element.
- `.nav-burger` is 36×36 — only because it's never the sole CTA on a screen and is always paired with the START_WORKSPACE button (which is 44+).
- `.nav-drawer a` is `padding:18px 4px` → ~50px row.

### 12.4 Mobile nav drawer (required)

The pre-audit design had **no mobile nav** — links + status pill were just `display:none` below 880, leaving only the brand and a single CTA on a 6-section page. Replacement (now in `index.html`):

- Burger button (`.nav-burger`) shown only at `≤1020px`. 36×36, hamburger drawn from a 14px line + two 1px pseudo-elements at `top:±5px`.
- Drawer (`.nav-drawer`) is a full-width fixed panel below the 56px nav, `position:fixed; inset:56px 0 0 0`. Each link is its own row with a green `→` glyph. Tapping a link auto-closes (delegated click handler). Resizing past 1020 also auto-closes.
- Status pill rides at the bottom of the drawer, full-readable.
- ARIA: `aria-expanded` on the burger, swap on toggle.

In the React port, mirror this exactly. Use `useState` + `useEffect` for the resize listener. Don't pull in a headless-ui menu — the markup is 6 anchors and a button.

### 12.5 Overflow / clipping fixes (preserve these)

These three rules silently fix layout bugs found during the audit. Removing any of them re-introduces the bug:

1. **`body { overflow-x: hidden }`** — defends against any single child miscalculation pushing horizontal scroll on narrow viewports. Keep.
2. **`.stream-row`, `.board-row` allow wrap on small viewports.** The pre-audit version used `white-space:nowrap; text-overflow:ellipsis` everywhere — on a 375px viewport that clipped agent message previews to ~25 chars, gutting the live-feed demo. The wrap rules are at `≤480px`.
3. **`.matrix` becomes horizontally-scrollable below 540px** with explicit min-width. Trying to fit 4 columns into 343px of usable container width produces unreadable 60–70px cells. Better to scroll than to squash. Add `aria-label="Scroll horizontally"` on the `<table>` wrapper in the React port.
4. **`.ascii` (workflow diagram) is `display:none` below 640px.** It's decoration, not content. The 5 step cards already convey the same flow.
5. **`background-attachment:fixed` removed from body.** It caused jank on iOS Safari and could interact poorly with `100vh` calculations. The grid background still renders correctly without it.
6. **`overflow-wrap:break-word` on `h1.hero-h`, `.sec-h`, `.cta h2`.** The uppercase headlines have words ≥9 chars (`WORKSPACE`, `TEAMMATES`) that overflow narrow viewports without explicit break.

### 12.6 Things to verify in the port

When you finish, run through this at 375 / 414 / 768 / 1024 / 1440 widths:

- [ ] No horizontal scroll on the `<body>` at any width (check `document.documentElement.scrollWidth === window.innerWidth`).
- [ ] Burger appears at ≤1020 and the drawer opens, closes on link tap, closes on resize past 1020.
- [ ] All headline tiers (`hero`, `sec`, `cta`) hit their intermediate sizes between 760 and 1020.
- [ ] Stream feed messages and board ticket titles remain readable (no ellipsis-clipping) on a 375px viewport.
- [ ] ASCII diagram is hidden at 375px.
- [ ] Matrix scrolls horizontally on 375px without breaking the page.
- [ ] "// RECOMMENDED" badge on the Cloud price card is inline (not absolute-positioned over the price) at ≤880px.
- [ ] Footer is single-column at ≤480 and 2-column with a full-width brand cell between 481–880.
- [ ] All `.btn` instances are ≥44px tall on mobile.
- [ ] No element exceeds `100vw` in scrollWidth at any of the 5 widths above.

If any check fails, **fix the standalone `index.html` first** so it remains the source of truth, then port the change.

---

## 13. Integrations surface (Slack + GitHub)

> The integrations page at `/[workspace]/integrations` is shared between
> web and desktop. It lives in `packages/views/integrations/integrations-page.tsx`
> and is wired into both apps' route trees. It is NOT part of the landing
> tree — but any landing-side change that touches `IntegrationConnection`
> types, `/api/config`, or the `useAuthStore` plumbing should re-verify
> the integrations page still loads.
>
> Backend deploy + env-var setup for both providers: see
> [docs/agenthost-releasing.md § Integration OAuth secrets](./agenthost-releasing.md#integration-oauth-secrets-server-side).

### 13.1 GitHub (shipped)

- **OAuth install** — `/auth/github/start?workspace=<slug>` → consent → `/auth/github/callback`. The callback intentionally has **no auth middleware**: the session cookie is `SameSite=Strict` and is dropped by browsers on the cross-site redirect from GitHub. Identity is recovered from the OAuth state cookie (`SameSite=Lax`) stashed during `/start`. Don't add `middleware.Auth(queries)` back to the callback or installs will 401 with `{"error":"missing authorization"}` — see commit `fc85aeb6`.
- **Manage panel** — `GitHubManagePanel` in `integrations-page.tsx`. Repo listing, issue import with project mapping, webhook registration, project ↔ repo binding.
- **Server endpoints** under `/api/workspaces/{id}/integrations/github/`: `repos`, `import-issues`, `register-webhook`, `webhooks`, `webhooks/{repo}` (delete).
- **Webhook ingestion** at `POST /webhooks/{provider}` — verifies HMAC via `GITHUB_WEBHOOK_SECRET`, dedupes via `integration_webhook_event(delivery_id)`, dispatches to `processGitHubWebhook`.
- **Frontend gating** — the Connect button only enables when `/api/config` returns `github_client_id`. That field is populated when `GITHUB_CLIENT_ID` is set on the server. The integrations page caches `/api/config` for 5 min (`staleTime`); hard-refresh after rotating the env var.

### 13.2 Slack (Phases 1–4 shipped, 5–7 pending)

The full design lives in [docs/slack-integration.md](./slack-integration.md). The epic and per-phase issues are at [johnefemer/multica#18](https://github.com/johnefemer/multica/issues/18).

#### Shipped

| Phase | What works | Commit(s) | Issue |
|---|---|---|---|
| **1** | OAuth install — bot is added to the Slack workspace | `247b0b7d` | — |
| **2** | Channel binding — admin picks Slack channels to route to a workspace; greeting message posts on bind; refreshable picker | `a634449b`, `91bc87da` | #19 |
| **3** | Inbound endpoints (`events` / `commands` / `interactivity`) with HMAC sig verification + seamless auto-onboarding identity bridge | `8e70599b` | #20 |
| **4** | `@agenthost` mention → ephemeral agent picker → agent reply lands in the same Slack thread (the flagship demo) | `2b2f39df` | #21 |

#### Pending

| Phase | What it adds | Issue |
|---|---|---|
| 5 | `/agenthost issue new/assign/status/show`, `/agenthost help`, `/agenthost link` | #22 |
| 6 | Outbound notifications — issue create/assign/status/task-complete → Block Kit cards in bound channels | #23 |
| 7 | Coding-agent ownership state machine + `/agenthost dispatch <id> <agent>` | #24 |

#### Required env vars (server-side)

`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` in `/opt/multica/.env`. Without `SLACK_CLIENT_ID` the backend doesn't register the provider and `/api/config` omits `slack_client_id`, which disables the Connect button.

#### Slack app config (one-time, in api.slack.com/apps → your app)

| Surface | URL |
|---|---|
| **OAuth & Permissions** → Redirect URL | `https://agenthost.kensink.com/auth/slack/callback` |
| **Event Subscriptions** → Request URL | `https://agenthost.kensink.com/webhooks/slack/events` |
| **Interactivity & Shortcuts** → Request URL | `https://agenthost.kensink.com/webhooks/slack/interactivity` |
| **Slash commands** (Phase 5+) → `/agenthost` → Request URL | `https://agenthost.kensink.com/webhooks/slack/commands` |

Bot events to subscribe (under Event Subscriptions): `app_mention`, `message.channels`, `message.groups`.

Bot scopes: `app_mentions:read`, `channels:history`, `channels:read`, `chat:write`, `commands`, `groups:history`, `groups:read`, `im:history`, `im:write`, `team:read`, `users:read`, `users:read.email`.

After scope changes, reinstall the app from Manage Distribution / Install App.

#### Schema reference

All migrations are additive — no destructive ops on existing chat tables.

| Migration | Adds |
|---|---|
| `063_chat_channel_binding` | `chat_channel_binding` (Slack channel ↔ workspace, 1:1; partial unique on `(platform, external_channel_id)`). Includes `default_agent_id` and `event_filters` columns now even though Phases 4 / 6 are what populate them — adding later would mean a churny second migration. |
| `064_chat_user_link` | `chat_user_link` (Slack user ↔ Agenthost user, per workspace; UNIQUE `(workspace_id, platform, external_user_id)` and `(workspace_id, user_id, platform)`). `workspace.chat_auto_onboard` defaults `true`. |
| `065_slack_chat_mirroring` | `chat_session` +`source`/+`external_team_id`/+`external_channel_id`/+`external_thread_id` with unique partial idx on `(source, external_thread_id) WHERE external_thread_id IS NOT NULL`. `chat_message` +`external_message_id`. New `slack_pending_chat_pick` table that stashes the user's mention text + identity between picker post and selection (10-min `expires_at`). |

#### Code map

| Concern | File |
|---|---|
| Slack provider (OAuth, signature verify) | `server/internal/messaging/slack/provider.go` |
| Slack API helpers (`conversations.list`, `chat.postMessage`, `chat.postEphemeral`, `users.info`) | `server/internal/messaging/slack/{channels,messages,users}.go` |
| Channel binding handlers | `server/internal/handler/slack_bindings.go` |
| Identity resolver (Phase 3) | `server/internal/handler/slack_identity.go` |
| Inbound webhook entry (events / commands / interactivity) | `server/internal/handler/slack_webhook.go` |
| Chat mirroring + agent picker (Phase 4) | `server/internal/handler/slack_chat.go` |
| Outbound: `chat:done` → Slack thread relay | `server/cmd/server/slack_chat_listener.go` (subscribes to event bus in `main.go`) |
| Frontend: Slack tile + Manage panel | `packages/views/integrations/integrations-page.tsx` (`SlackManagePanel`) |
| API client + React Query hooks | `packages/core/api/client.ts`, `packages/core/integrations/queries.ts` |
| Types | `packages/core/types/integration.ts` (`SlackChannel`, `ChatChannelBinding`, `IntegrationConnection`) |

#### Gotchas

1. **`integrations-page.tsx` has TWO `IntegrationCard` call sites** — "Connected" and "Available" sections. Both must pass `slackClientId` (and `githubClientId`). Missing the prop → button perma-disabled. Regression caught + fixed in commit `650ddb01`.
2. **Bot can't post to private channels it's not in.** The picker calls `conversations.list` which only returns channels the bot is a member of for private ones. The dialog copy already says "Add the bot to private channels first via Slack's 'Add apps to channel' menu — only channels the bot is in will appear here."
3. **OAuth callback identity** — the `SameSite=Strict` session-cookie problem applies to Slack too. Phase 1 reused the same fix as GitHub: drop auth middleware on the callback, stash userID in the state cookie (`SameSite=Lax`).
4. **Slack 3-second ACK rule** — `/webhooks/slack/{commands,interactivity}` MUST 200 within 3s. Real work happens in detached goroutines that reply async via `chat.postMessage` or `response_url`. The events endpoint also acks 202 immediately.
5. **Block Kit `static_select` value cap of 75 chars.** That's why the agent picker stashes the user's mention text in `slack_pending_chat_pick` and only puts `(pickID|agentID)` (two UUIDs ≈ 73 chars) in the option `value`. Don't try to inline the message text.
6. **The bot's own posts must be ignored** — `dispatchSlackEvent` checks `BotID != ""` first, otherwise the bot's "Working on it…" reply would re-trigger the mention handler and recurse.
7. **Frontend `/api/config` cache is 5 min** (`staleTime`). Hard-refresh after env var rotation.
8. **`workspace.chat_auto_onboard`** defaults `true`. First-touch users are auto-created from their Slack profile email + name. Set to `false` from settings to require explicit invites.
9. **`chat_session.agent_id` is NOT NULL** — that's why Phase 4 needs the `slack_pending_chat_pick` flow rather than creating a session up front and updating it on selection.
10. **`url_verification` challenge** — Slack's first request to a new events URL is `{"type":"url_verification","challenge":"..."}` and expects the challenge token echoed back. The handler does signature verification BEFORE the type-switch (correct order — never process unverified payloads), so a curl probe without a valid sig returns 401 even for the challenge type. That's expected; Slack itself signs the challenge.
11. **`integration_webhook_event(delivery_id)` is the dedupe table** for both GitHub and Slack. Slack uses `event_id` as the delivery key. Reused, no new table needed.
12. **The "Connected" Slack tile shows the captured workspace name + Team ID + granted scopes**, plus an "Open in Slack" deep-link. Honest panel copy lists what's wired vs. what's coming so users aren't misled by the integration card description.

#### `useSlackBindings` / `useSlackChannels` query keys

```ts
integrationKeys.slackChannels(wsId)  // ["integrations", wsId, "slack", "channels"]
integrationKeys.slackBindings(wsId)  // ["integrations", wsId, "slack", "bindings"]
```

`useSlackChannels(wsId, enabled)` gates the network call on `enabled` (the picker only fetches when open) and caches for 5 min. `useCreateSlackBinding` and `useDeleteSlackBinding` invalidate `slackBindings` on success.

#### End-to-end smoke test (manual — no automated coverage yet)

1. From integrations page → Connect Slack → install.
2. Open the Manage panel → "Bind channel" → pick `#some-channel`. The bot should post a greeting in that channel.
3. In `#some-channel`: `@agenthost help me with X`.
4. **Expected**:
   - If exactly 1 active agent → that agent auto-picks; "🤖 *Agent* is on it…" posts in the thread; agent's reply lands in the same thread.
   - If 2+ agents and no `binding.default_agent_id` → ephemeral picker shown only to you → pick one → ack + reply.
5. Reply in the same thread (as starter) → continues the conversation (look up `chat_session` by `external_thread_id`).
6. Reply by anyone else in the thread → one-time ephemeral note about the v1 1:1 limitation.
7. Failures: `docker logs agenthost-backend-1 --tail=200 | grep -i slack`.

#### Things NOT to do

- **Don't add the auth middleware back to `/auth/{provider}/callback`.** It will 401 every install. (Same fix story for GitHub and Slack.)
- **Don't process Slack events synchronously past the 3s ACK** — Slack will retry 3× and your handler will run 4×. Use the detached goroutine + `chat.postMessage` pattern.
- **Don't render HTML from translation strings** in the Manage panel (matches the landing rule). All copy is in TSX.
- **Don't bind a channel from a slash command yet.** Plan calls for an admin-only flow from the integrations page (`POST /api/workspaces/{id}/integrations/slack/bindings`); a slash-command path was considered and rejected in [docs/slack-integration.md](./slack-integration.md).
- **Don't call `chat.postMessage` from the request goroutine** in webhook handlers — always detach. The request context is canceled the moment we ACK, and the post would silently fail.

---

**Reference order when stuck:**

1. `index.html` — pixel-level visual truth.
2. This doc (`DEV_CONTEXT.md`) — how to translate it into the app.
3. `CONTEXT.md` — product/brand voice for any copy gaps.
4. `web/features/landing/components/landing-hero.tsx` — current dark-hero pattern.
5. `web/features/landing/components/features-section.tsx` — current scroll-driven interactive pattern (the `IntersectionObserver` setup is the template for the header active state).
