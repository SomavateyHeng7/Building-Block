import { expect, type Page } from "@playwright/test";
import { PRIVACY_VERSION } from "../src/lib/consent";

/** Marks the privacy notice as accepted before any page script runs (in every tab of the test). */
export async function acceptConsent(page: Page) {
  await page.context().addInitScript((version) => {
    window.localStorage.setItem("bb:consent", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
  }, PRIVACY_VERSION);
}

/**
 * Hides the File System Access API, so Save downloads and Open uses a file input: the native pickers
 * can't be driven from a test.
 */
export async function withoutFilePickers(page: Page) {
  await page.context().addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", { value: undefined });
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined });
  });
}

/** From the start page, opens the L0 template in the editor. */
export async function openTemplate(page: Page) {
  await page.goto("/diagrams");
  await page.getByRole("button", { name: /L0 Architecture/ }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.locator(".react-flow__node-block").first()).toBeVisible();
}

/** Narrow screens open the editor in view mode; switch to editing if so. */
export async function ensureEditMode(page: Page) {
  const edit = page.getByRole("button", { name: "Edit", exact: true });
  if (await edit.isVisible()) await edit.click();
}

/** Starts a blank diagram and adds a container from the empty canvas. */
export async function startBlankWithContainer(page: Page) {
  await page.goto("/diagrams");
  await page.getByRole("button", { name: /New blank diagram/ }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await ensureEditMode(page);
  await page.locator(".react-flow").getByRole("button", { name: "Container", exact: true }).click();
  await expect(page.locator(".react-flow__node-container")).toHaveCount(1);
}

/** The page never scrolls sideways. */
export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, "page is wider than the screen").toBeLessThanOrEqual(clientWidth);
}
