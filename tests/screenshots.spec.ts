import { test } from "@playwright/test";

declare const process: { env: Record<string, string | undefined> };

// Interview backup screenshots. Run with: SCREENSHOTS=1 npx playwright test screenshots
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture");
test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });

test("capture walkthrough states", async ({ page }) => {
  const shot = (name: string) => page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: true });
  const btn = (name: string) => page.getByRole("button", { name });
  await page.goto("./");
  await page.evaluate(() => document.fonts.ready);
  await shot("01-fresh-concern");
  await btn("Review supporting evidence").click();
  await shot("02-fresh-evidence");
  await btn("Hide supporting evidence").click();
  await btn("Dismiss Concern…").click();
  await page.getByLabel("Other").check();
  await page.getByLabel(/Describe the reason/).fill("abc");
  await shot("03a-dismiss-other-feedback");
  await page.getByLabel("Concern already addressed").check();
  await shot("03-dismiss-reason");
  await btn("Confirm dismissal").click();
  await shot("04-concern-dismissed");
  await btn("Reset demo").click();
  await btn("Request Inspection").click();
  await shot("05-inspection-requested");
  await page.getByLabel("Stale telemetry").check();
  await shot("06-stale-assessment-withheld");
  await btn("Review supporting evidence").click();
  await shot("07-stale-evidence");
  await btn("Hide supporting evidence").click();
  await btn("Request Inspection").click();
  await shot("08-stale-inspection-requested");
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  test("capture mobile states", async ({ page }) => {
    const shot = (name: string) => page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: true });
    const btn = (name: string) => page.getByRole("button", { name });
    await page.goto("./");
    await page.evaluate(() => document.fonts.ready);
    await shot("m01-fresh-concern");
    await btn("Dismiss Concern…").click();
    await page.getByLabel("Other").check();
    await shot("m02-dismiss-other-feedback");
    await btn("Cancel").click();
    await page.getByLabel("Stale telemetry").check();
    await shot("m03-stale-assessment-withheld");
    await btn("Request Inspection").click();
    await shot("m04-stale-inspection-requested");
  });
});

