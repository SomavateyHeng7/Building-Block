import { statSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { acceptConsent, openTemplate, startBlankWithContainer, withoutFilePickers } from "./helpers";

test.beforeEach(async ({ page }) => {
  await acceptConsent(page);
  await withoutFilePickers(page);
});

test("draw, save as a file, and open it again", async ({ page }, testInfo) => {
  await startBlankWithContainer(page);

  const [download] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("ControlOrMeta+s")]);
  expect(download.suggestedFilename()).toBe("untitled-diagram.json");
  const path = testInfo.outputPath("saved.json");
  await download.saveAs(path);

  // A fresh load has nothing open; the file brings the diagram back.
  await page.goto("/diagrams");
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Open a diagram file/ }).click(),
  ]);
  await chooser.setFiles(path);
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.locator(".react-flow__node-container")).toHaveCount(1);
});

test("a broken file is refused with a message", async ({ page }) => {
  await page.goto("/diagrams");
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Open a diagram file/ }).click(),
  ]);
  await chooser.setFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from("not json") });
  await expect(page.getByRole("alert").filter({ hasText: 'Couldn\'t open "notes.json"' })).toBeVisible();
  await expect(page).toHaveURL(/\/diagrams$/);
});

test("export a PNG of the template", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Rendering is the same on every device; one run is enough");
  await openTemplate(page);
  await page.getByRole("button", { name: "Export" }).click();
  const dialog = page.getByRole("dialog", { name: /Export/ });
  const png = dialog.getByRole("checkbox", { name: /PNG image/ });
  await png.check();
  // Just the PNG, so one file arrives.
  for (const other of ["SVG image", "PDF", "Component list", "Connection list", "Diagram file"]) {
    await dialog.getByRole("checkbox", { name: new RegExp(other) }).uncheck();
  }
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: /^Download/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const saved = testInfo.outputPath("export.png");
  await download.saveAs(saved);
  // A real picture, not a blank canvas.
  expect(statSync(saved).size).toBeGreaterThan(10_000);
});
