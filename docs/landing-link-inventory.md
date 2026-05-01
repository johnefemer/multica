# Landing — Header + Footer Link Inventory

Captured before the Ops Console redesign of `/`. Used to compare the old serif `<AgenthostLanding />` against the new `<OpsLanding />` after deploy.

Source files at time of capture:
- `apps/web/features/landing/components/landing-header.tsx`
- `apps/web/features/landing/components/landing-footer.tsx`
- `apps/web/features/landing/i18n/en.ts` (footer.groups + header strings)

---

## OLD — `<AgenthostLanding />` (current `/`)

### Header
Variant: `dark` (transparent, white text). Used on `/` and `/homepage`. Light variant on `/about` and `/changelog`.

| Slot | Label | Href | Notes |
|---|---|---|---|
| Brand | agenthost (icon + lowercase wordmark) | `/` | |
| Right CTA | GitHub | `https://github.com/johnefemer/multica` | external |
| Right CTA | Log in / Dashboard | `/login` (logged out) → `/` (logged in) | auth-aware |

**No nav menu items.** Header is brand-left, two-buttons-right.

### Footer
Single dark surface, 3 link groups, locale switcher, giant lowercase wordmark.

**Brand cell (left):**
| Slot | Label | Href |
|---|---|---|
| Brand link | agenthost | `#product` (anchor) |
| Social | GitHub icon | `https://github.com/johnefemer/multica` |
| CTA | Get started / Dashboard | `/login` → `/` (auth-aware) |

**Group: Product**
| Label | Href |
|---|---|
| Features | `#features` |
| How it Works | `#how-it-works` |
| Changelog | `/changelog` |

**Group: Resources**
| Label | Href |
|---|---|
| Documentation | `/docs` (does not exist — 404) |
| API | `https://github.com/johnefemer/multica` |

**Group: Company**
| Label | Href |
|---|---|
| About | `/about` |
| Open Source | `#open-source` |
| GitHub | `https://github.com/johnefemer/multica` |

**Bottom row:** copyright `© {year} Agenthost. All rights reserved.` + locale switcher (EN / 中文).

### Other CTAs in scope
- Hero primary CTA → `t.hero.cta` ("Start free trial")
- Hero secondary `t.hero.downloadDesktop` ("Download Desktop") — string still in dict, button surface already removed in commit `cc64aa09`. Leave the string for now; will drop when dict is rewritten for Ops.

---

## NEW — `<OpsLanding />` (per `index.html`)

### Header
Sticky 56px bar, dark blur, hairline bottom border, mobile drawer ≤1020px.

| Slot | Label | Href in source | Notes |
|---|---|---|---|
| Brand | AGENTHOST + `// KENSINK_LABS` lab tag | `/` (we'll wire) | |
| Nav | PRODUCT | `#product` | maps to §01 PROPOSITION |
| Nav | WORKFLOW | `#workflow` | maps to §03 THE_LOOP |
| Nav | COMPARE | `#compare` | maps to §05 VS_REST |
| Nav | PRICING | `#pricing` | maps to §06 PRICING |
| Nav | DOCS | `#docs` | **placeholder, no target** — revise post-deploy |
| Nav | CHANGELOG | `#changelog` | **placeholder, no target** — revise post-deploy (real route exists at `/changelog`) |
| Status pill | `● ONLINE · 1,247 RUNTIMES` | — | decorative |
| Right CTA | START_WORKSPACE → | `#cta` | will be wired auth-aware to `/login` ↔ `/` |
| Mobile | Burger → drawer (mirrors nav + status pill) | | |

### Footer
Five-column grid (1.4fr brand + 4×1fr link groups), bottom row, no giant logo.

**Brand cell:** AGENTHOST mark + tagline `"The control plane for AI-augmented engineering teams. Built by Kensink Labs. Shenzhen → the internet."`

**Group: PRODUCT** (all `#` placeholders in source)
| Label | Href in source |
|---|---|
| Issues | `#` |
| Agents | `#` |
| Skills | `#` |
| Autopilot | `#` |
| Inbox | `#` |
| Runtimes | `#` |

**Group: RESOURCES**
| Label | Href in source |
|---|---|
| Docs | `#` |
| CLI reference | `#` |
| Changelog | `#` (real route at `/changelog`) |
| Self-host guide | `#` |
| Status | `#` |

**Group: COMPANY**
| Label | Href in source |
|---|---|
| About Kensink | `#` (real route at `/about`) |
| Manifesto | `#` |
| Open source | `#` (real target = GitHub repo) |
| Contact | `#` |
| Press kit | `#` |

**Group: LEGAL**
| Label | Href in source |
|---|---|
| Terms | `#` |
| Privacy | `#` |
| Security | `#` |
| DPA | `#` |
| Sub-processors | `#` |

**Bottom row:** `© 2026 KENSINK_LABS · ALL_RIGHTS_RESERVED · MIT_LICENSED` + `// BUILT WITH GO + POSTGRES + WS · v0.9.4`.

### Things the new design dropped that we must add back
1. **Locale switcher (EN / 中文).** Source has none; ZH route depends on this control.
2. **GitHub external link in footer brand cell.** Source has none; needed for the Open-source narrative.

### Things to wire on first deploy (vs leaving as `#`)
- `START_WORKSPACE` (header + hero + CTA section) → auth-aware `/login` ↔ `/` via `useAuthStore`.
- Per user instruction: every other `href="#"` ships as-is. Revise post-deploy.

---

## `/download` status

Already hidden, no action required:
- `apps/web/app/(landing)/download/page.tsx` does `redirect("/")`.
- `download-client.tsx` is orphaned (no longer imported).
- Not in `sitemap.xml`.
- Not in `robots.txt` allow list.
- Old header + footer don't link to it.
- Recent commit `cc64aa09` removed the desktop download surface.

The new Ops design must NOT surface a download CTA either. Confirmed against `index.html`: no download link present.
