import { expect, test, type Locator } from "@playwright/test";
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

test("a component connects to a container, the arrow's end can be moved, and the arrow deleted", async ({ page, isMobile }) => {
  test.skip(isMobile, "Dragging between connection dots is checked with a mouse");
  await acceptConsent(page);
  await openTemplate(page);

  const edges = page.locator(".react-flow__edge");
  const before = await edges.count();
  const panel = page.getByRole("complementary");

  /** Drags with the mouse from the middle of one element to the middle of another. */
  async function drag(from: Locator, to: Locator, hover?: Locator) {
    const start = (await from.boundingBox())!;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    if (hover) await hover.hover({ force: true });
    const end = (await to.boundingBox())!;
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
    await page.mouse.up();
  }

  const block = page.locator(".react-flow__node-block").first();
  const container = page.locator(".react-flow__node-container").last();
  const blockLabel = (await block.innerText()).trim();
  const containerLabel = (await container.locator("[data-container-header]").innerText()).trim();
  await block.hover();
  await drag(block.locator(".react-flow__handle-bottom"), container.locator(".react-flow__handle-top"));
  await expect(edges).toHaveCount(before + 1);
  await expect(panel.getByRole("heading", { name: "Connection" })).toBeVisible();
  await expect(panel.getByText(`${blockLabel} → ${containerLabel}`)).toBeVisible();

  // Drag the arrow's head onto another component.
  const other = page.locator(".react-flow__node-block").nth(1);
  const otherLabel = (await other.innerText()).trim();
  await drag(page.locator(".react-flow__edge.selected .react-flow__edgeupdater-target"), other.locator(".react-flow__handle-top"), other);
  await expect(panel.getByText(`${blockLabel} → ${otherLabel}`)).toBeVisible();
  await expect(edges).toHaveCount(before + 1);

  await page.keyboard.press("Delete");
  await expect(edges).toHaveCount(before);
  await expect(panel.getByRole("heading", { name: "Connection" })).toBeHidden();
});
