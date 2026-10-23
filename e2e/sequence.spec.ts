import { statSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { acceptConsent } from "./helpers";

async function openSequenceTemplate(page: Page) {
  await page.goto("/diagrams");
  await page.getByRole("button", { name: /Sequence diagram/ }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.locator(".bb-sequence-sheet")).toBeVisible();
}

test("the sequence template draws its flow, and a message is drawn by dragging between lifelines", async ({ page, isMobile }) => {
  test.skip(isMobile, "Drawing is checked with a mouse");
  await acceptConsent(page);
  await openSequenceTemplate(page);

  const sheet = page.locator(".bb-sequence-sheet");
  const steps = sheet.locator("[data-step]");
  const before = await steps.count();
  await expect(sheet.getByRole("button", { name: "Customer (person)" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Message 1\. Place order/ })).toBeVisible();

  // Drag from the Web Shop's lifeline to the Payment Gateway's, above the first message.
  const from = (await sheet.locator("[data-lifeline]").nth(1).boundingBox())!;
  const to = (await sheet.locator("[data-lifeline]").nth(3).boundingBox())!;
  const y = from.y + 12;
  await page.mouse.move(from.x + from.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, y, { steps: 8 });
  await page.mouse.up();
  await expect(steps).toHaveCount(before + 1);

  // It opens in the panel, ready to name.
  const panel = page.getByRole("complementary");
  await expect(panel.getByRole("heading", { name: "Message" })).toBeVisible();
  const label = panel.getByRole("textbox", { name: "What's sent" });
  await expect(label).toBeFocused();
  await label.fill("Refund");
  await panel.getByRole("radio", { name: "Async" }).click();
  await expect(sheet.getByRole("button", { name: /Refund/ })).toBeVisible();

  // It went in first; ↓ moves it later, Delete removes it, undo brings it back.
  await expect(steps.first()).toContainText("Refund");
  await sheet.getByRole("button", { name: /Refund/ }).click();
  await page.keyboard.press("ArrowDown");
  await expect(steps.nth(1)).toContainText("Refund");
  await page.keyboard.press("Delete");
  await expect(steps).toHaveCount(before);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(steps).toHaveCount(before + 1);
});

test("a sequence tab is added beside an architecture tab, and filled from the palette", async ({ page, isMobile }) => {
  test.skip(isMobile, "The palette is a drawer on small screens");
  await acceptConsent(page);
  await page.goto("/diagrams");
  await page.getByRole("button", { name: /L0 Architecture/ }).click();
  await page.getByRole("button", { name: "Add a sequence tab" }).click();
  await expect(page.getByRole("tab", { name: /Sequence 2 \(sequence diagram\)/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Who takes part in this flow?")).toBeVisible();

  const palette = page.locator("aside").first();
  await palette.getByRole("button", { name: "Actor (person)" }).click();
  await page.getByRole("complementary").getByRole("textbox", { name: "Name" }).fill("Architect");
  await palette.getByRole("button", { name: "Microservices" }).click();
  const sheet = page.locator(".bb-sequence-sheet");
  await expect(sheet.getByRole("button", { name: "Architect (person)" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Microservices" })).toBeVisible();

  // The panel adds a message without dragging.
  await sheet.click({ position: { x: 4, y: 4 } });
  await page.getByRole("complementary").getByRole("button", { name: "Add message" }).click();
  await expect(sheet.locator("[data-step]")).toHaveCount(1);

  // Boxes can't be added here; going back to the first tab shows its canvas again.
  await page.keyboard.press("Escape");
  await page.keyboard.press("c");
  await page.getByRole("tab").first().click();
  await expect(page.locator(".react-flow__node-block").first()).toBeVisible();
});

test("a sequence tab exports as a picture", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Rendering is the same on every device; one run is enough");
  await acceptConsent(page);
  await openSequenceTemplate(page);
  await page.getByRole("button", { name: "Export" }).click();
  const dialog = page.getByRole("dialog", { name: /Export/ });
  await dialog.getByRole("checkbox", { name: /PNG image/ }).check();
  for (const other of ["SVG image", "PDF", "Component list", "Connection list", "Diagram file"]) {
    await dialog.getByRole("checkbox", { name: new RegExp(other) }).uncheck();
  }
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: /^Download/ }).click()]);
  expect(download.suggestedFilename()).toBe("checkout-flow.png");
  const saved = testInfo.outputPath("sequence.png");
  await download.saveAs(saved);
  expect(statSync(saved).size).toBeGreaterThan(10_000);
});
