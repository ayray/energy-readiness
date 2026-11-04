import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "http://localhost:4173/energy-readiness/";
const DISCLAIMER =
  "Independent product concept inspired by public information. Simulated data. Not affiliated with Safire.";
const FORBIDDEN = [
  /\bAI\b/, /predict/i, /confidence/i, /probability/i, /endurance/i, /remaining (useful )?life/i,
  /\bR[1-3]\b/, // developer rule labels stay out of the interface
];

let consoleErrors: string[];
let requests: string[];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  requests = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("./");
});

test.afterEach(() => {
  expect(consoleErrors, "no console errors (AC-13)").toEqual([]);
  expect(requests.filter((u) => !u.startsWith(ORIGIN)), "no off-origin requests (AC-12)").toEqual([]);
});

const status = (page: Page) => page.locator(".status");
const decision = (page: Page) => page.locator(".decision");
const btn = (page: Page, name: string | RegExp) => page.getByRole("button", { name });

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

async function expectCopyRules(page: Page) {
  const text = await page.locator("body").innerText();
  for (const term of FORBIDDEN) expect(text, `forbidden term ${term}`).not.toMatch(term);
  await expect(page.getByText(DISCLAIMER)).toBeVisible();
  await expect(page.locator("img, svg")).toHaveCount(0);
}

test("AC-01 initial state: fresh scenario with a concern", async ({ page }) => {
  await expect(status(page)).toContainText("Review recommended");
  await expect(status(page)).toContainText("Battery health concern detected — review before deployment.");
  await expect(status(page)).toContainText("simulated health flag");
  await expect(status(page)).toContainText("not a verified diagnosis");
  await expect(page.locator(".card").nth(0)).toContainText("Watch");
  await expect(page.locator(".card").nth(0)).toContainText("Mock");
  await expect(page.locator(".card").nth(1)).toContainText("81%");
  await expect(page.locator(".card").nth(2)).toContainText("3 min ago");
  await expect(page.locator(".card").nth(2)).toContainText("Fresh: within the 15-minute limit, a proposed concept policy");
  await expect(page.locator("#evidence-panel")).toBeHidden();
  await expect(btn(page, "Request Inspection")).toBeEnabled();
  await expect(btn(page, "Dismiss Concern…")).toBeEnabled();
  await expect(page.getByLabel("Fresh telemetry")).toBeChecked();
});

test("AC-02 the disclaimer is visible in every state", async ({ page }) => {
  const visible = () => expect(page.getByText(DISCLAIMER)).toBeVisible();
  await visible();
  await btn(page, "Request Inspection").click();
  await visible();
  await page.getByLabel("Stale telemetry").check();
  await visible();
  await btn(page, "Request Inspection").click();
  await visible();
});

test("AC-03 evidence panel toggles and explains the rule and its limits", async ({ page }) => {
  const toggle = btn(page, "Review supporting evidence");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  const panel = page.locator("#evidence-panel");
  await expect(panel).toBeVisible();
  await expect(btn(page, "Hide supporting evidence")).toHaveAttribute("aria-expanded", "true");
  for (const text of [
    "Review check (proposed concept policy, mock data)",
    "At 09:38 (3 min ago), the health flag changed from Normal to Watch. Charge is 81%.",
    "What this establishes",
    "What this does not establish",
    "Whether the battery will fail",
    "Limitations",
    "not a Safire diagnostic or standard",
  ]) {
    await expect(panel).toContainText(text);
  }
  // Readings are stated once in the evidence, not repeated as a separate block.
  await expect(panel).not.toContainText("State of charge:");
  await btn(page, "Hide supporting evidence").click();
  await expect(panel).toBeHidden();
});

for (const scenario of ["Fresh telemetry", "Stale telemetry"]) {
  test(`Polish: expanding evidence (${scenario}) leaves the decision actions in place and on screen at 1280×800`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByLabel(scenario).check();
    const before = await btn(page, "Request Inspection").boundingBox();
    await btn(page, "Review supporting evidence").click();
    await expect(page.locator("#evidence-panel")).toBeVisible();
    const after = await btn(page, "Request Inspection").boundingBox();
    expect(after!.y).toBe(before!.y);
    expect(after!.y + after!.height).toBeLessThanOrEqual(800);
    await expect(btn(page, "Dismiss Concern…")).toBeInViewport();
  });
}

test("AC-04 Request Inspection escalates and records the decision", async ({ page }) => {
  await btn(page, "Request Inspection").click();
  await expect(status(page)).toContainText("Inspection requested");
  await expect(status(page)).toContainText("Escalated for review.");
  await expect(status(page)).toContainText("Readiness stays unresolved until the review is complete.");
  const record = decision(page).locator(".record");
  await expect(record).toContainText("Inspection requested");
  await expect(record).toContainText("Health flag Watch (mock) · data 3 min old");
  await expect(record).toContainText("09:41 (simulated time)");
  await expect(record).toContainText("Open: awaiting review");
  await expect(decision(page)).toContainText("Simulated: nothing was sent");
  await expect(page.getByRole("heading", { name: "Latest decision" })).toBeFocused();
});

test("AC-05 dismissal requires a reason; Other needs at least 5 characters", async ({ page }) => {
  await btn(page, "Dismiss Concern…").click();
  const confirm = btn(page, "Confirm dismissal");
  await expect(page.getByLabel("Concern already addressed")).toBeFocused();
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveAccessibleDescription("Choose a reason to confirm.");
  await page.getByLabel("Other").check();
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveAccessibleDescription(/at least 5 characters to confirm/);
  const other = page.getByLabel(/Describe the reason/);
  await other.fill("abcd");
  await expect(confirm).toBeDisabled();
  await expect(other).toHaveAccessibleDescription("4 of 5 characters minimum");
  await expectAccessible(page);
  // Confirm stays focusable and on screen, so its reason can be found.
  await confirm.focus();
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".record")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = (await confirm.boundingBox())!;
  expect(box.y + box.height, "Confirm visible at 1280×800 without scrolling").toBeLessThanOrEqual(800);
  await other.fill("abcde");
  await expect(confirm).toBeEnabled();
  await expect(other).toHaveAccessibleDescription("Minimum length met");
  await expect(page.locator("#confirm-blocker")).toHaveCount(0);
  await page.getByLabel("Reviewed; no further action needed").check();
  await expect(confirm).toBeEnabled();
});

test("AC-06 a confirmed dismissal closes the warning and is not a deployment authorization", async ({ page }) => {
  await btn(page, "Dismiss Concern…").click();
  await page.getByLabel("Concern already addressed").check();
  await btn(page, "Confirm dismissal").click();
  await expect(status(page)).toContainText("Concern dismissed: not a deployment authorization");
  await expect(status(page)).toContainText("Follow your normal release procedure for UGV-012.");
  const record = decision(page).locator(".record");
  await expect(record).toContainText("Health flag Watch (mock) · data 3 min old");
  await expect(record).toContainText("Reason");
  await expect(record).toContainText("Concern already addressed");
  await expect(record).toContainText("Closed · not a deployment authorization");
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/\b(approved for deployment|cleared for deployment|ready to deploy)\b/i);
  await expect(page.locator(".status-dismissed")).toBeVisible();
});

test("AC-06 an Other reason is recorded with its text", async ({ page }) => {
  await btn(page, "Dismiss Concern…").click();
  await page.getByLabel("Other").check();
  await page.getByLabel(/Describe the reason/).fill("Battery swapped this morning");
  await btn(page, "Confirm dismissal").click();
  await expect(decision(page).locator(".record")).toContainText("Other: Battery swapped this morning");
});

test("AC-07 Cancel returns to the decision with no record", async ({ page }) => {
  await btn(page, "Dismiss Concern…").click();
  await btn(page, "Cancel").click();
  await expect(btn(page, "Dismiss Concern…")).toBeFocused();
  await expect(page.locator(".record")).toHaveCount(0);
  await expect(status(page)).toContainText("Review recommended");
});

test("AC-08 stale scenario withholds the assessment and marks historical readings", async ({ page }) => {
  await page.getByLabel("Stale telemetry").check();
  await expect(status(page)).toContainText("Cannot assess: data out of date");
  await expect(status(page)).toContainText("Current readiness assessment withheld.");
  await expect(status(page)).toContainText("42 minutes old");
  await expect(status(page)).toContainText("follow your local manual check procedure");
  await expect(status(page)).not.toContainText("Review recommended");
  const cards = page.locator(".card");
  await expect(cards.nth(0)).toContainText("Last known: ▲ Watch");
  await expect(cards.nth(1)).toContainText("Last known: 81%");
  await expect(cards.nth(2)).toContainText("42 min ago");
  await expect(cards.nth(2)).toContainText("Stale: older than the 15-minute limit, a proposed concept policy");
  // One historical marker for the panel, not one per reading.
  await expect(page.locator(".telemetry .pill-historical")).toHaveCount(1);
  await expect(page.locator(".telemetry-head")).toContainText("Historical readings · 42 min old");
  await expect(page.locator(".telemetry.is-historical")).toBeVisible();
  await expect(btn(page, "Review supporting evidence")).toHaveAccessibleDescription(/Why the assessment is withheld/);
  await btn(page, "Review supporting evidence").click();
  await expect(page.locator("#evidence-panel")).toContainText("Freshness check (proposed concept policy)");
  await expect(page.locator("#evidence-panel")).toContainText("proposed concept policy that needs customer validation");
  await expectAccessible(page);
});

test("AC-09 stale: Dismiss is blocked with a visible reason; inspection still works", async ({ page }) => {
  await page.getByLabel("Stale telemetry").check();
  const dismiss = btn(page, "Dismiss Concern…");
  await expect(dismiss).toBeDisabled();
  await expect(dismiss).toHaveAccessibleDescription(/needs battery data from the last 15 minutes/);
  await expect(page.locator("#dismiss-blocked")).toBeVisible();
  await btn(page, "Request Inspection").click();
  await expect(status(page)).toContainText("Inspection requested");
  await expect(decision(page).locator(".record")).toContainText("Last known health flag Watch (mock) · data 42 min old");
  await expect(decision(page).locator(".record")).toContainText("Requested while battery data was out of date");
});

test("AC-10 switching scenario clears the decision; reset restores the initial state", async ({ page }) => {
  await btn(page, "Request Inspection").click();
  await page.getByLabel("Stale telemetry").check();
  await expect(page.locator(".record")).toHaveCount(0);
  await expect(status(page)).toContainText("Cannot assess");
  await btn(page, "Request Inspection").click();
  await btn(page, "Review supporting evidence").click();
  await btn(page, "Reset demo").click();
  await expect(page.getByLabel("Fresh telemetry")).toBeChecked();
  await expect(status(page)).toContainText("Review recommended");
  await expect(page.locator(".record")).toHaveCount(0);
  await expect(page.locator("#evidence-panel")).toBeHidden();
  await expect(btn(page, "Dismiss Concern…")).toBeEnabled();
});

test("AC-11 accessible in every state and operable by keyboard", async ({ page }) => {
  // Every status shows a shape and a text label, not color alone.
  await expect(page.locator(".status-label .shape")).toHaveText("▲");
  await expectAccessible(page);
  await btn(page, "Review supporting evidence").click();
  await expectAccessible(page);

  await btn(page, "Dismiss Concern…").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Concern already addressed")).toBeFocused();
  await page.keyboard.press("Space");
  await expectAccessible(page);
  await page.keyboard.press("Tab"); // Tab leaves the radio group in one step
  await expect(btn(page, "Confirm dismissal")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".status-label .shape")).toHaveText("✓");
  await expectAccessible(page);

  await page.getByLabel("Stale telemetry").check();
  await expect(page.locator(".status-label .shape")).toHaveText("◌");
  await expectAccessible(page);
  await btn(page, "Request Inspection").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".status-label .shape")).toHaveText("■");
  await expectAccessible(page);
});

test("AC-12 copy rules, no logos, no requests after load", async ({ page }) => {
  await page.waitForLoadState("networkidle");
  const before = requests.length;
  await expectCopyRules(page);
  await btn(page, "Review supporting evidence").click();
  await expectCopyRules(page);
  await btn(page, "Dismiss Concern…").click();
  await page.getByLabel("Other").check();
  await expectCopyRules(page);
  await page.getByLabel(/Describe the reason/).fill("Checked by hand");
  await btn(page, "Confirm dismissal").click();
  await expectCopyRules(page);
  await page.getByLabel("Stale telemetry").check();
  await btn(page, "Review supporting evidence").click();
  await expectCopyRules(page);
  await btn(page, "Request Inspection").click();
  await expectCopyRules(page);
  await btn(page, "Reset demo").click();
  expect(requests.slice(before), "no network requests during the walkthrough").toEqual([]);
});

test("AC-13 full walkthrough on the production build at its Pages base path", async ({ page }) => {
  expect(page.url()).toBe(ORIGIN);
  await expect(page).toHaveTitle("Energy Readiness · Operator Decision Review");
  await btn(page, "Review supporting evidence").click();
  await btn(page, "Request Inspection").click();
  await page.getByLabel("Stale telemetry").check();
  await btn(page, "Request Inspection").click();
  await btn(page, "Reset demo").click();
  await btn(page, "Dismiss Concern…").click();
  await page.getByLabel("Reviewed; no further action needed").check();
  await btn(page, "Confirm dismissal").click();
  await btn(page, "Reset demo").click();
  await expect(status(page)).toContainText("Review recommended");
  const fontsLoaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('16px "Barlow"') && document.fonts.check('16px "JetBrains Mono"');
  });
  expect(fontsLoaded).toBe(true);
});

for (const [width, height] of [
  [1280, 800],
  [1440, 900],
  [1024, 768],
] as const) {
  test(`AC-14 no horizontal scroll at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const step of [
      async () => {},
      async () => btn(page, "Review supporting evidence").click(),
      async () => btn(page, "Dismiss Concern…").click(),
      async () => page.getByLabel("Stale telemetry").check(),
    ]) {
      await step();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
    if (width >= 1280) {
      // The decision is visible without scrolling, so the 30-second read includes the actions.
      await btn(page, "Reset demo").click();
      const box = await btn(page, "Request Inspection").boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
      // Decision column and telemetry column side by side.
      await expect(page.locator(".layout")).toHaveCSS("grid-template-columns", /^\S+ \S+$/);
    }
  });
}

test("Evidence is optional: both actions work without opening it, and it sits directly under the decision", async ({ page }) => {
  await expect(page.locator("#evidence-panel")).toBeHidden();
  await expect(btn(page, "Request Inspection")).toBeEnabled();
  await expect(btn(page, "Dismiss Concern…")).toBeEnabled();
  const actions = (await page.locator(".actions").boundingBox())!;
  const toggle = (await btn(page, "Review supporting evidence").boundingBox())!;
  expect(toggle.y).toBeGreaterThan(actions.y);
  expect(toggle.y - (actions.y + actions.height)).toBeLessThan(120);
  await expect(btn(page, "Review supporting evidence")).toBeInViewport();
  await btn(page, "Dismiss Concern…").click();
  await page.getByLabel("Concern already addressed").check();
  await btn(page, "Confirm dismissal").click();
  await expect(status(page)).toContainText("Concern dismissed");
  await expect(page.locator("#evidence-panel")).toBeHidden();
});

test("Layout: telemetry left (~40%), decision review right (~60%) on desktop; warning first on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const tele = (await page.locator(".telemetry").boundingBox())!;
  const stat = (await status(page).boundingBox())!;
  expect(tele.x + tele.width).toBeLessThan(stat.x);
  const ratio = tele.width / (tele.width + stat.width);
  expect(ratio).toBeGreaterThan(0.35);
  expect(ratio).toBeLessThan(0.45);
  await expect(page.locator(".telemetry")).toContainText("Current readings");
  await page.getByLabel("Stale telemetry").check();
  await expect(page.locator(".telemetry")).toContainText("Historical readings");
  await page.setViewportSize({ width: 375, height: 812 });
  const statM = (await status(page).boundingBox())!;
  const teleM = (await page.locator(".telemetry").boundingBox())!;
  expect(statM.y).toBeLessThan(teleM.y);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("Accent: the energy accent appears only while telemetry is fresh", async ({ page }) => {
  const accentCount = () =>
    page.evaluate(() => {
      const accent = "rgb(95, 227, 176)";
      return [...document.querySelectorAll("*")].filter((el) => {
        const cs = getComputedStyle(el);
        return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.backgroundImage].some((v) => v.includes(accent));
      }).length;
    });
  expect(await accentCount()).toBeGreaterThan(0);
  await page.getByLabel("Stale telemetry").check();
  expect(await accentCount()).toBe(0);
  await btn(page, "Request Inspection").click();
  expect(await accentCount()).toBe(0);
});

test("Critique fixes: the warning is a heading, scenario changes are announced, mock labels are not repeated", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 2, name: "Battery health concern detected — review before deployment." })).toBeVisible();
  await expect(page.getByText("All values simulated")).toHaveCount(0);
  await expect(page.getByText(/^Mock$/)).toHaveCount(1);
  const live = page.locator("p.sr-only[aria-live]").first();
  await page.getByLabel("Stale telemetry").check();
  await expect(live).toHaveText(/Stale telemetry scenario\. .*assessment is withheld/);
  await expect(page.getByRole("heading", { level: 2, name: "Current readiness assessment withheld." })).toBeVisible();
  await btn(page, "Reset demo").click();
  await expect(live).toHaveText(/^Demo reset\. Fresh telemetry scenario/);
  // No visible text below 12px.
  const tiny = await page.evaluate(() =>
    [...document.querySelectorAll("body *")].filter((el) => {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      return own && !el.closest(".sr-only") && parseFloat(getComputedStyle(el).fontSize) < 12;
    }).length,
  );
  expect(tiny).toBe(0);
});

test("Mobile 375×812: compact chrome, clock on one line, warning near the top", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const clock = (await page.locator(".clock").boundingBox())!;
  expect(clock.height).toBeLessThan(30);
  const stat = (await status(page).boundingBox())!;
  expect(stat.y).toBeLessThan(320);
  await expect(btn(page, "Request Inspection")).toBeInViewport();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});


test("Back to portfolio: correct destination, keyboard reachable, outside the workflow, fits at 375 px", async ({ page }) => {
  const link = page.getByRole("link", { name: "Back to portfolio" });
  await expect(link).toHaveAttribute("href", "https://ayray.github.io/");
  await expect(link).not.toHaveAttribute("target", /.+/);
  // Application-level navigation: in the header, never inside the status, decision, or evidence.
  await expect(page.locator(".appbar").getByRole("link", { name: "Back to portfolio" })).toHaveCount(1);
  await expect(page.locator(".status a, .decision a, .evidence a")).toHaveCount(0);
  await expect(page.getByRole("link")).toHaveCount(1);

  // Keyboard: Tab from Reset reaches the link, with a visible focus outline, then continues to the decision.
  await btn(page, "Reset demo").focus();
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Tab");
  await expect(btn(page, "Request Inspection")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(status(page)).toContainText("Inspection requested");

  // Desktop: one header row; the link sits right of the clock.
  const appbar = (await page.locator(".appbar").boundingBox())!;
  expect(appbar.height).toBeLessThan(70);

  // Mobile: on the clock's row, no horizontal scroll, warning not pushed down.
  await page.setViewportSize({ width: 375, height: 812 });
  const l = (await link.boundingBox())!;
  const c = (await page.locator(".clock").boundingBox())!;
  expect(Math.abs(l.y + l.height / 2 - (c.y + c.height / 2))).toBeLessThan(6);
  await expect(link).toBeInViewport({ ratio: 1 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect((await status(page).boundingBox())!.y).toBeLessThan(290);
});

test("Header at narrower desktop widths: no clipping, overlap, or horizontal scroll", async ({ page }) => {
  for (const width of [1100, 1024, 1000, 981, 900, 641]) {
    await page.setViewportSize({ width, height: 800 });
    const result = await page.evaluate(() => {
      const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const row = box(".appbar-row");
      const items = ["h1", ".appbar-meta .pill", ".clock", ".back-link"].map(box);
      const overlap = items.some((a, i) =>
        items.slice(i + 1).some((b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1),
      );
      const clipped = items.some((r) => r.right > row.right + 0.5 || r.left < row.left - 0.5);
      return { overlap, clipped, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(result, `header at ${width}px`).toEqual({ overlap: false, clipped: false, overflow: 0 });
  }
  // 1024 px keeps the one-row desktop header with room to spare.
  await page.setViewportSize({ width: 1024, height: 768 });
  expect((await page.locator(".appbar").boundingBox())!.height).toBeLessThan(70);
  const slack = await page.evaluate(() => {
    const h1 = document.querySelector("h1")!.getBoundingClientRect();
    const meta = document.querySelector(".appbar-meta")!.getBoundingClientRect();
    return meta.left - h1.right;
  });
  expect(slack).toBeGreaterThanOrEqual(24);
});

