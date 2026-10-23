import { expect, test } from "@playwright/test";
import { acceptConsent, openTemplate } from "./helpers";

test("legend entries reorder by dragging or arrow keys, and a removed one's items can move to another", async ({ page, isMobile }) => {
  test.skip(isMobile, "The legend is in a drawer on small screens");
  await acceptConsent(page);
  await openTemplate(page);

  const legend = page.getByRole("heading", { name: "Legend" }).locator("xpath=../..");
  const names = legend.getByRole("button", { name: /Double-click or press Enter to rename/ });
  const order = async () => (await names.allInnerTexts()).map((text) => text.trim());
  const start = await order();

  // Drag the first entry's handle below the third.
  const handle = legend.getByRole("button", { name: `Move ${start[0]}. Use the up and down arrow keys` });
  const from = (await handle.boundingBox())!;
  const target = (await names.nth(2).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, target.y + target.height * 0.9, { steps: 8 });
  await page.mouse.up();
  await expect.poll(order).toEqual([start[1], start[2], start[0], ...start.slice(3)]);

  // And back up with the keyboard; focus stays on the handle.
  await handle.focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect.poll(order).toEqual(start);
  await expect(handle).toBeFocused();

  // Remove an entry that's in use, moving its items to the next one.
  const usedRow = legend.locator("[data-legend-row]").filter({ has: page.locator("span[title^='Used by']") });
  const victim = (await usedRow.first().getByRole("button", { name: /to rename/ }).innerText()).trim();
  const keeper = start.find((name) => name !== victim)!;
  await usedRow.first().hover();
  await legend.getByRole("button", { name: `Remove ${victim}`, exact: true }).click();
  const box = legend.getByRole("group", { name: `Remove ${victim}` });
  await box.getByRole("combobox").selectOption({ label: keeper });
  await box.getByRole("button", { name: "Move and remove" }).click();
  await expect.poll(order).toEqual(start.filter((name) => name !== victim));
  await expect(page.locator(".react-flow__node-block[style*='dashed']")).toHaveCount(0);
});
