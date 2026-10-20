import { expect, test } from "@playwright/test";
import { acceptConsent } from "./helpers";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The service worker is the same on every device");
  await acceptConsent(page);
});

test("the app can be installed: manifest with icons and diagram file handling", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.start_url).toBe("/diagrams");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(manifest.file_handlers[0].accept["application/json"]).toContain(".json");
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
});

test("after one visit, the app opens and edits offline", async ({ page, context }) => {
  await page.goto("/");
  // Wait until the service worker has cached the app and controls the page.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.goto("/diagrams");
  await expect(page.getByRole("heading", { name: "Start a diagram" })).toBeVisible();
  await page.getByRole("button", { name: /L0 Architecture/ }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.locator(".react-flow__node-block").first()).toBeVisible();

  // The other pages were cached when the app was installed, not only the ones visited.
  await page.goto("/contact");
  await expect(page.getByRole("heading", { name: "Contact us" })).toBeVisible();
  await context.setOffline(false);
});
