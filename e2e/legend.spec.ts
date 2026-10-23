import { expect, test } from "@playwright/test";
import { acceptConsent, openTemplate } from "./helpers";

test("a legend entry is renamed by double-clicking its name, and Esc cancels", async ({ page, isMobile }) => {
  test.skip(isMobile, "The legend is in a drawer on small screens");
  await acceptConsent(page);
  await openTemplate(page);

  const legend = page.getByRole("heading", { name: "Legend" }).locator("xpath=../..");
  const name = legend.getByRole("button", { name: /Double-click or press Enter to rename/ }).first();
  const before = (await name.innerText()).trim();
  const field = legend.getByRole("textbox", { name: "Legend entry name" });

  // A single click doesn't start editing.
  await name.click();
  await expect(field).toBeHidden();

  await name.dblclick();
  await field.fill("Retiring");
  await field.press("Escape");
  await expect(legend.getByText(before, { exact: true })).toBeVisible();

  await name.dblclick();
  await field.fill("Retiring");
  await field.press("Enter");
  await expect(field).toBeHidden();
  await expect(legend.getByText("Retiring", { exact: true })).toBeVisible();

  // A new entry opens ready to type its name.
  await legend.getByRole("button", { name: "Add" }).click();
  await expect(field).toBeFocused();
});
