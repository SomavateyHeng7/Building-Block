import { expect, test } from "@playwright/test";
import { acceptConsent } from "./helpers";

test.beforeEach(async ({ page }) => {
  await acceptConsent(page);
});

test("compare tabs lists what changed and jumps to it", async ({ page }) => {
  await page.goto("/diagrams");
  await page.getByRole("button", { name: /Current vs target state/ }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.locator(".react-flow__node-block").first()).toBeVisible();

  await page.getByRole("button", { name: "Compare tabs" }).click();
  const dialog = page.getByRole("dialog", { name: "Compare tabs" });
  // Opened on "Current", the first tab, so it compares it with the tab after it.
  await expect(dialog.getByLabel("From").locator("option:checked")).toHaveText("Current");
  await expect(dialog.getByLabel("To").locator("option:checked")).toHaveText("Target");
  await expect(dialog).toContainText("added");
  await expect(dialog.getByRole("button", { name: /Removed\s*Legacy CRM/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Changed\s*Customer Website/ })).toContainText(
    "Category: Product Components → Enhancement Components",
  );

  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: /Download change list/ }).click();
  expect((await download).suggestedFilename()).toBe("current-vs-target-state-current-vs-target.csv");

  // Picking an added component opens the tab it is on with it selected.
  await dialog.getByRole("button", { name: "Added Mobile App", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("tab", { name: "Target" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".react-flow__node-block.selected")).toContainText("Mobile App");
});

test("the templates page lists every template", async ({ page }) => {
  await page.goto("/templates");
  for (const name of ["L0 Architecture", "Three-tier web application", "Event-driven microservices", "Current vs target state"]) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
});

test("compare marks what changed on the canvas, on both tabs, until stopped", async ({ page }) => {
  await page.goto("/diagrams");
  await page.getByRole("button", { name: /Current vs target state/ }).click();
  await expect(page.locator(".react-flow__node-block").first()).toBeVisible();

  await page.getByRole("button", { name: "Compare tabs" }).click();
  await page.getByRole("dialog", { name: "Compare tabs" }).getByRole("button", { name: "Show on canvas" }).click();

  // Additions and changes are on the "to" tab.
  await expect(page.getByRole("tab", { name: "Target" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".react-flow__node.bb-change-added")).toContainText(["Mobile App"]);
  await expect(page.locator(".react-flow__node.bb-change-changed").filter({ hasText: "Customer Website" })).toHaveCount(1);

  // Removals are on the "from" tab, where they still are.
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await expect(page.locator(".react-flow__node.bb-change-removed").filter({ hasText: "Legacy CRM" })).toHaveCount(1);

  await page.getByRole("button", { name: "Stop showing" }).click();
  await expect(page.locator(".react-flow__node.bb-change")).toHaveCount(0);
});
