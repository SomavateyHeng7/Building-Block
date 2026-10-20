import { expect, test, type Page } from "@playwright/test";
import { acceptConsent, startBlankWithContainer, withoutFilePickers } from "./helpers";

test.beforeEach(async ({ page }) => {
  await acceptConsent(page);
  await withoutFilePickers(page);
});

const hasCopy = (page: Page) => page.evaluate(() => !!localStorage.getItem("bb:recovery:copy"));

async function turnOnRecovery(page: Page) {
  await page.goto("/diagrams");
  await page.getByRole("checkbox", { name: /Keep a recovery copy/ }).check();
}

test("is off by default: nothing is kept after the tab closes", async ({ page, context }) => {
  await page.goto("/diagrams");
  await expect(page.getByRole("checkbox", { name: /Keep a recovery copy/ })).not.toBeChecked();
  await startBlankWithContainer(page);
  await page.waitForTimeout(800);
  expect(await hasCopy(page)).toBe(false);
  await page.close({ runBeforeUnload: false });

  const next = await context.newPage();
  await next.goto("/diagrams");
  await expect(next.getByRole("region", { name: "Unsaved changes" })).toBeHidden();
});

test("turned on, unsaved changes survive a closed tab, and saving removes the copy", async ({ page, context }) => {
  await turnOnRecovery(page);
  await startBlankWithContainer(page);
  // The copy is written shortly after the last edit.
  await expect.poll(() => hasCopy(page)).toBe(true);
  await page.close({ runBeforeUnload: false });

  const next = await context.newPage();
  await next.goto("/diagrams");
  const card = next.getByRole("region", { name: "Unsaved changes" });
  await expect(card).toContainText("Untitled Diagram");
  await card.getByRole("button", { name: "Recover" }).click();
  await expect(next).toHaveURL(/\/editor$/);
  await expect(next.locator(".react-flow__node-container")).toHaveCount(1);

  await Promise.all([next.waitForEvent("download"), next.keyboard.press("ControlOrMeta+s")]);
  await expect.poll(() => hasCopy(next)).toBe(false);
});

test("discarding on the start page deletes the copy", async ({ page, context }) => {
  await turnOnRecovery(page);
  await startBlankWithContainer(page);
  await expect.poll(() => hasCopy(page)).toBe(true);
  await page.close({ runBeforeUnload: false });

  const next = await context.newPage();
  await next.goto("/diagrams");
  const card = next.getByRole("region", { name: "Unsaved changes" });
  await card.getByRole("button", { name: "Discard" }).click();
  await card.getByRole("button", { name: "Delete the changes?" }).click();
  await expect(card).toBeHidden();
  expect(await hasCopy(next)).toBe(false);
});

test("turning it off from the File menu deletes the copy", async ({ page }) => {
  await turnOnRecovery(page);
  await startBlankWithContainer(page);
  await expect.poll(() => hasCopy(page)).toBe(true);

  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: /Keep a recovery copy/ }).click();
  await expect.poll(() => hasCopy(page)).toBe(false);
});
