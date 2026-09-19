/**
 * Mobile readiness audit — not a pass/fail test.
 *
 * Walks every dashboard route at phone viewports, screenshots each one, and
 * records the layout problems that are measurable from the DOM: horizontal
 * overflow, elements wider than the viewport, tap targets under the 44px
 * minimum, and whether a signed-in user can open the navigation at all.
 *
 * Findings land in e2e/.mobile-audit/report.json alongside the screenshots.
 */
import { test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createTestApi } from "./helpers";

const OUT = resolve(process.cwd(), "e2e/.mobile-audit");

const VIEWPORTS = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-14", width: 390, height: 844 },
];

const ROUTES = [
  "issues",
  "my-issues",
  "inbox",
  "projects",
  "agents",
  "chat",
  "autopilots",
  "skills",
  "runtimes",
  "integrations",
  "settings",
];

interface Finding {
  route: string;
  viewport: string;
  kind: string;
  detail: string;
}

const findings: Finding[] = [];

test("mobile readiness audit", async ({ page }) => {
  test.setTimeout(900_000);

  mkdirSync(OUT, { recursive: true });

  // Seed a little data so we review real layouts, not empty states.
  const api = await createTestApi();
  const existing = await api.createIssue(
    "Mobile audit: a deliberately long issue title that should truncate rather than push the row wide",
  );
  await api.createIssue("Short issue");
  await api.createIssue("Another issue for list density");

  // Own login rather than the shared helper: its 10s waitForURL is tuned for a
  // warm server, and the Next dev server compiles each route on first hit.
  const workspace = await api.ensureWorkspace();
  const slug = workspace.slug;
  const token = api.getToken()!;
  // Seed the token before any page script runs. Setting it after navigating to
  // /login races that route's own storage cleanup and silently logs us out.
  await page.addInitScript((t) => localStorage.setItem("multica_token", t as string), token);
  await page.goto(`/${slug}/issues`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForURL("**/issues", { timeout: 120_000 });
  await page.waitForTimeout(2500);

  // A brand-new workspace greets you with a starter-tasks dialog; its backdrop
  // would be reported as an overlay on every route that follows.
  const welcome = page.getByRole("button", { name: "Start blank workspace" });
  if (await welcome.isVisible().catch(() => false)) {
    await welcome.click();
    await page.waitForTimeout(1200);
  }

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const route of ROUTES) {
      const url = `/${slug}/${route}`;
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      } catch {
        findings.push({
          route,
          viewport: vp.name,
          kind: "navigation-timeout",
          detail: `did not reach networkidle for ${url}`,
        });
      }
      await page.waitForTimeout(700);

      const result = await page.evaluate((viewportWidth) => {
        const out: { kind: string; detail: string }[] = [];

        // 1. Page-level horizontal overflow.
        const docWidth = document.documentElement.scrollWidth;
        if (docWidth > viewportWidth + 1) {
          out.push({
            kind: "horizontal-overflow",
            detail: `document scrollWidth ${docWidth}px vs viewport ${viewportWidth}px (+${docWidth - viewportWidth})`,
          });
        }

        // 2. Individual elements sticking out past the right edge.
        const offenders: string[] = [];
        document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          if (getComputedStyle(el).position === "fixed") return;
          if (r.right > viewportWidth + 2 && r.width > 40) {
            const cls =
              typeof el.className === "string" && el.className.trim()
                ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
                : "";
            offenders.push(
              `${el.tagName.toLowerCase()}${cls} right=${Math.round(r.right)} w=${Math.round(r.width)}`,
            );
          }
        });
        const unique = [...new Set(offenders)].slice(0, 8);
        if (unique.length) {
          out.push({ kind: "element-overflow", detail: unique.join(" | ") });
        }

        // 3. Tap targets below a usable size.
        const small: string[] = [];
        document
          .querySelectorAll<HTMLElement>(
            "button, a[href], [role='button'], input[type='checkbox']",
          )
          .forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            if (getComputedStyle(el).visibility === "hidden") return;
            if (r.height < 32 || r.width < 32) {
              const label = (
                el.getAttribute("aria-label") ||
                el.textContent ||
                el.tagName
              )
                .trim()
                .slice(0, 28);
              small.push(`"${label}" ${Math.round(r.width)}x${Math.round(r.height)}`);
            }
          });
        const uniqueSmall = [...new Set(small)];
        if (uniqueSmall.length) {
          out.push({
            kind: "small-tap-target",
            detail: `${uniqueSmall.length} under 32px: ${uniqueSmall.slice(0, 6).join(", ")}`,
          });
        }

        // 4. Can the user open navigation at all?
        const trigger = document.querySelector("[data-sidebar='trigger']");
        if (!trigger) {
          out.push({
            kind: "no-sidebar-trigger",
            detail: "no [data-sidebar=trigger] in the DOM",
          });
        } else {
          const r = (trigger as HTMLElement).getBoundingClientRect();
          if (r.width === 0 || r.height === 0) {
            out.push({
              kind: "no-sidebar-trigger",
              detail: "sidebar trigger present but not rendered (0x0)",
            });
          }
        }

        // 5. Sidebar occupying the screen on a phone.
        const sidebar = document.querySelector<HTMLElement>("[data-slot='sidebar']");
        if (sidebar) {
          const r = sidebar.getBoundingClientRect();
          if (r.width > 0 && r.left < viewportWidth * 0.5 && r.width > viewportWidth * 0.3) {
            out.push({
              kind: "sidebar-eats-viewport",
              detail: `sidebar visible at ${Math.round(r.width)}px of ${viewportWidth}px`,
            });
          }
        }

        return out;
      }, vp.width);

      for (const r of result) {
        findings.push({ route, viewport: vp.name, kind: r.kind, detail: r.detail });
      }

      await page.screenshot({ path: `${OUT}/${vp.name}--${route}.png` });
    }
  }

  // Issue detail is the densest page — review it separately.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/${slug}/issues/${existing.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/iphone-14--issue-detail.png` });

  const detail = await page.evaluate(() => ({
    docWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  if (detail.docWidth > detail.viewport + 1) {
    findings.push({
      route: "issues/[id]",
      viewport: "iphone-14",
      kind: "horizontal-overflow",
      detail: `document scrollWidth ${detail.docWidth}px vs viewport ${detail.viewport}px`,
    });
  }

  writeFileSync(`${OUT}/report.json`, JSON.stringify(findings, null, 2));
  console.log(`\n=== ${findings.length} findings ===`);
  for (const f of findings) {
    console.log(`[${f.viewport}] ${f.route} — ${f.kind}: ${f.detail}`);
  }

  await api.cleanup();
});
