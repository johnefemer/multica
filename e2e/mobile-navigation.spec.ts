/**
 * Phone-sized regression guards for navigation.
 *
 * Both tests cover bugs where the page rendered correctly but could not be
 * used, which is the kind of failure a screenshot review misses.
 */
import { test, expect, devices, type Page } from "@playwright/test";
import pg from "pg";
import { createTestApi } from "./helpers";
import type { TestApiClient } from "./fixtures";

test.use({ ...devices["iPhone 13"] });

/** A fresh database sends every new user to /onboarding, which is not what
 *  these tests are about. Mark the account onboarded so login lands on the app. */
async function skipOnboarding() {
  const client = new pg.Client(
    process.env.DATABASE_URL ??
      "postgres://multica:multica@localhost:5432/multica?sslmode=disable",
  );
  await client.connect();
  await client.query(`UPDATE "user" SET onboarded_at = now() WHERE onboarded_at IS NULL`);
  await client.end();
}

/** Seed the token before any page script runs. Setting it after navigating to
 *  /login races that route's own storage cleanup and silently logs us out. */
async function signIn(page: Page, api: TestApiClient): Promise<string> {
  const workspace = await api.ensureWorkspace();
  await page.addInitScript(
    (t) => localStorage.setItem("multica_token", t as string),
    api.getToken()!,
  );
  return workspace.slug;
}

/** A brand-new workspace greets you with a starter-tasks dialog whose backdrop
 *  would otherwise be mistaken for the leak these tests look for. */
async function dismissWelcome(page: Page) {
  const welcome = page.getByRole("button", { name: "Start blank workspace" });
  if (await welcome.isVisible().catch(() => false)) {
    await welcome.click();
    await page.waitForTimeout(1000);
  }
}

let api: TestApiClient;

test.beforeEach(async () => {
  api = await createTestApi();
  await skipOnboarding();
});

test.afterEach(async () => {
  await api.cleanup();
});

test("opening an issue from the board leaves the page interactive", async ({ page }) => {
  test.setTimeout(180_000);
  // Give the detail page real work to render. The sheet only leaks when the
  // isMobile flip and the effect that closes the sidebar land in separate
  // commits with a paint between them, and a trivial issue settles too fast
  // for that window to open.
  const description = Array.from(
    { length: 40 },
    (_, i) => `Line ${i + 1} of a description long enough to make the detail page do real rendering work.`,
  ).join("\n\n");
  await api.createIssue("Mobile navigation regression issue", { description });

  const slug = await signIn(page, api);
  await page.goto(`/${slug}/issues`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForURL("**/issues", { timeout: 120_000 });
  await page.waitForTimeout(2500);
  await dismissWelcome(page);

  const card = page.locator('a[href*="/issues/"]').first();
  await card.waitFor({ state: "visible", timeout: 60_000 });
  await card.tap();
  await page.waitForURL("**/issues/**", { timeout: 30_000 });
  await page.waitForTimeout(2500);

  // The properties sidebar is a modal Sheet on phones. If it mounts already
  // open it is closed again in the same commit, no transition ever runs, and
  // Base UI never unmounts it — leaving an invisible backdrop that swallows
  // every tap until the user reloads.
  await expect(
    page.locator('[role="dialog"]'),
    "no sheet should be mounted after navigating to the issue detail",
  ).toHaveCount(0);

  // The real symptom: taps stop reaching the page.
  const toggle = page.getByRole("button", { name: /toggle sidebar/i }).first();
  await expect(toggle).toBeVisible();
  await toggle.tap({ timeout: 10_000 });
  await expect(
    page.locator('[role="dialog"]'),
    "tapping the sidebar toggle should open the sheet, proving taps land",
  ).toHaveCount(1);
});

test("settings is navigable on a phone", async ({ page }) => {
  test.setTimeout(180_000);
  const slug = await signIn(page, api);
  await page.goto(`/${slug}/settings`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(3000);
  await dismissWelcome(page);

  // Settings does not use PageHeader on desktop, and without its own trigger a
  // phone user has no way back to navigation from this page.
  await expect(
    page.locator("[data-sidebar='trigger']"),
    "settings needs a sidebar trigger on phones",
  ).toBeVisible();

  // The tab rail becomes a horizontal strip. The base list centres its items,
  // and a centred flex row that overflows pushes the leading tabs to a negative
  // offset that no scrolling can reach, hiding the selected tab.
  const selected = page.locator('[role="tab"][aria-selected="true"]').first();
  await expect(selected).toBeVisible();
  const box = await selected.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box, "the selected tab should have a box").not.toBeNull();
  expect(box!.x, "the selected tab must not sit off the left edge").toBeGreaterThanOrEqual(0);
  expect(box!.x, "the selected tab must start within the viewport").toBeLessThan(viewport.width);
});
