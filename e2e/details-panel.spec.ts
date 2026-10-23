import { expect, test } from "@playwright/test";
import { acceptConsent, openTemplate } from "./helpers";

test("a component connects to a container from the panel's picker", async ({ page, isMobile }) => {
  test.skip(isMobile, "Checked on the side panel of a wide screen");
  await acceptConsent(page);
  await openTemplate(page);

  const edges = page.locator(".react-flow__edge");
  const before = await edges.count();
  const containerLabel = (await page.locator(".react-flow__node-container [data-container-header]").last().innerText()).trim();
  await page.locator(".react-flow__node-block").first().click();
  await page.getByRole("combobox", { name: "Connect to another component or container" }).selectOption({ label: containerLabel });
  await expect(edges).toHaveCount(before + 1);
});

test("with the panel in a drawer, Esc in a field keeps it open and the note badge opens it", async ({ page, isMobile }) => {
  test.skip(isMobile, "Drawers in edit mode are checked at tablet-landscape width");
  await page.setViewportSize({ width: 900, height: 800 });
  await acceptConsent(page);
  await openTemplate(page);

  const drawer = page.getByRole("complementary");
  const openDrawer = page.getByRole("button", { name: /Details/ });
  await page.locator(".react-flow__node-block").first().click();
  await openDrawer.click();
  await expect(drawer).toBeVisible();

  // Esc while typing doesn't close the drawer.
  const notes = drawer.getByRole("textbox", { name: "Notes" });
  await notes.fill("Risk: vendor lock-in");
  await notes.press("Escape");
  await expect(drawer).toBeVisible();

  // Close it, then the badge brings it back with the cursor in Notes.
  await page.getByRole("button", { name: "Close panel" }).click({ position: { x: 10, y: 10 } });
  await expect(drawer).toBeHidden();
  await page.getByRole("button", { name: "Edit notes" }).first().click();
  await expect(drawer).toBeVisible();
  await expect(notes).toBeFocused();
});
