import { expect, test } from "@playwright/test";
import { acceptConsent } from "./helpers";

test.beforeEach(async ({ page }) => {
  await acceptConsent(page);
  await page.goto("/diagrams");
  await page.getByRole("button", { name: /Current vs target state/ }).click();
  await expect(page.locator(".react-flow__node-block").first()).toBeVisible();
});

test("search finds a component on another tab and goes to it", async ({ page }) => {
  await expect(page.getByRole("tab", { name: "Current" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Find in diagram" }).click();
  const dialog = page.getByRole("dialog", { name: "Find in diagram" });
  await dialog.getByRole("combobox").fill("mobile");
  await expect(dialog.getByRole("option").first()).toContainText("Mobile App");
  await dialog.getByRole("combobox").press("Enter");

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("tab", { name: "Target" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".react-flow__node-block.selected")).toContainText("Mobile App");
});

test("Ctrl+F opens search and says when nothing matches", async ({ page, isMobile }) => {
  test.skip(isMobile, "Keyboard shortcut");
  await page.locator(".react-flow__pane").click();
  await page.keyboard.press("Control+f");
  const dialog = page.getByRole("dialog", { name: "Find in diagram" });
  await dialog.getByRole("combobox").fill("zzzz");
  await expect(dialog).toContainText("Nothing matches");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
