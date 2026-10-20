import { expect, test } from "@playwright/test";
import { acceptConsent, openTemplate } from "./helpers";

test.beforeEach(async ({ page }) => {
  await acceptConsent(page);
});

test("phone-sized screens open diagrams in view mode: tap for details, nothing moves", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 768, "Wider screens open in edit mode");
  await openTemplate(page);

  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Add$/ })).toBeHidden();
  await expect(page.getByRole("button", { name: "Undo" })).toBeHidden();

  // Dragging a component pans the view instead of moving it: it keeps its place next to its neighbour.
  const node = page.locator(".react-flow__node-block").filter({ hasText: "Customer Portal" });
  const neighbour = page.locator(".react-flow__node-block").filter({ hasText: "Mobile App" });
  const offset = async () => {
    const [a, b] = [await node.boundingBox(), await neighbour.boundingBox()];
    return { x: Math.round(a!.x - b!.x), y: Math.round(a!.y - b!.y) };
  };
  const before = await offset();
  const box = await node.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + 80, box!.y + 80, { steps: 5 });
  await page.mouse.up();
  expect(await offset()).toEqual(before);

  await node.tap();
  const sheet = page.getByRole("region", { name: "Details" });
  await expect(sheet.getByRole("heading", { name: "Customer Portal" })).toBeVisible();
  await expect(sheet).toContainText("Connections");
  await sheet.getByRole("button", { name: "Close details" }).tap();
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: "Legend" }).tap();
  await expect(page.getByRole("region", { name: "Details" }).getByRole("heading", { name: "Legend" })).toBeVisible();

  // Switching to Edit brings the editing tools back.
  await page.getByRole("button", { name: "Edit" }).tap();
  await expect(page.getByRole("button", { name: /^Add$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
});

test("screens 768px and wider open in edit mode", async ({ page }) => {
  const width = page.viewportSize()!.width;
  test.skip(width < 768, "Narrower screens open in view mode");
  await openTemplate(page);
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeHidden();
});
