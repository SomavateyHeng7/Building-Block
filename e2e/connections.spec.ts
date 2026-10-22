import { expect, test } from "@playwright/test";
import { acceptConsent, openTemplate } from "./helpers";

test("a connection's route can be changed and its line dragged clear, then put back", async ({ page, isMobile }) => {
  test.skip(isMobile, "Dragging the bend dot is checked with a mouse");
  await acceptConsent(page);
  await openTemplate(page);

  // Open a connection's details from the first component that has one.
  const blocks = page.locator(".react-flow__node-block");
  const count = await blocks.count();
  for (let index = 0; index < count; index++) {
    await blocks.nth(index).click();
    const listed = page.getByRole("complementary").getByRole("listitem").getByRole("button");
    if (await listed.count()) {
      await listed.first().click();
      break;
    }
  }
  const panel = page.getByRole("complementary");
  await expect(panel.getByRole("heading", { name: "Connection" })).toBeVisible();

  await panel.getByRole("radio", { name: "Curved" }).click();
  await expect(panel.getByRole("radio", { name: "Curved" })).toHaveAttribute("aria-checked", "true");

  const dot = page.getByRole("button", { name: "Move the line" });
  const box = (await dot.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 80, { steps: 5 });
  await page.mouse.up();
  await expect(panel.getByRole("button", { name: "Reset line" })).toBeVisible();

  await panel.getByRole("button", { name: "Reset line" }).click();
  await expect(panel.getByRole("button", { name: "Reset line" })).toBeHidden();
});
