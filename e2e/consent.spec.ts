import { expect, test } from "@playwright/test";

test("the app asks for the privacy notice first; Not now goes home", async ({ page }) => {
  await page.goto("/diagrams");
  const dialog = page.getByRole("dialog", { name: "Before you start" });
  await expect(dialog).toBeVisible();
  const accept = dialog.getByRole("button", { name: "Accept and continue" });
  await expect(accept).toBeDisabled();

  await dialog.getByRole("button", { name: "Not now" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("accepting lets people in and is remembered", async ({ page }) => {
  await page.goto("/diagrams");
  const dialog = page.getByRole("dialog", { name: "Before you start" });
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Accept and continue" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Start a diagram" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Start a diagram" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Before you start" })).toBeHidden();
});
