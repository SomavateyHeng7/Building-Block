import { expect, test } from "@playwright/test";
import { acceptConsent, expectNoHorizontalScroll, openTemplate } from "./helpers";

const PAGES = ["/", "/diagrams", "/templates", "/privacy", "/contact", "/this-page-does-not-exist"];

test.beforeEach(async ({ page }) => {
  await acceptConsent(page);
});

for (const path of PAGES) {
  test(`${path} fits the screen`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
}

test("the editor fits the screen, and small controls stay small on touch screens", async ({ page }) => {
  await openTemplate(page);
  await expectNoHorizontalScroll(page);
  // Tabs sit in a 36px row: the touch-target minimum mustn't stretch them past it.
  const tab = await page.getByRole("tab").first().boundingBox();
  expect(tab!.height).toBeLessThanOrEqual(36);
});

test("the File menu opens inside the screen", async ({ page }) => {
  await openTemplate(page);
  await page.getByRole("button", { name: "File", exact: true }).click();
  const menu = await page.getByRole("menu").boundingBox();
  const width = page.viewportSize()!.width;
  expect(menu!.x).toBeGreaterThanOrEqual(0);
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(width);
  await expectNoHorizontalScroll(page);
});
