import { expect, test } from "@playwright/test";
import { acceptConsent, openTemplate } from "./helpers";

test("deleting a container asks about its components, and they can be grouped again", async ({ page, isMobile }) => {
  test.skip(isMobile, "Delete and Ctrl+G are keyboard shortcuts");
  await acceptConsent(page);
  await openTemplate(page);

  const blocks = page.locator(".react-flow__node-block");
  const containers = page.locator(".react-flow__node-container");
  const blockCount = await blocks.count();
  const containerCount = await containers.count();

  await containers.first().locator("[data-container-header]").click();
  await page.keyboard.press("Delete");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(/holds \d+ component/);
  await dialog.getByRole("button", { name: "Keep components" }).click();
  await expect(containers).toHaveCount(containerCount - 1);
  await expect(blocks).toHaveCount(blockCount);

  // Group the released components back into a container.
  await blocks.first().click();
  await page.keyboard.press("ControlOrMeta+g");
  await expect(containers).toHaveCount(containerCount);
  await expect(page.getByRole("complementary").getByRole("heading", { name: "Container", exact: true })).toBeVisible();

  await page.keyboard.press("Delete");
  await dialog.getByRole("button", { name: "Delete everything" }).click();
  await expect(containers).toHaveCount(containerCount - 1);
  await expect(blocks).toHaveCount(blockCount - 1);
});
