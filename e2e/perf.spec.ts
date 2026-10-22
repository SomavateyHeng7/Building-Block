import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { acceptConsent, withoutFilePickers } from "./helpers";
import { stressDiagram, stressStats } from "../tests/perf/stressDiagram";

/**
 * Baseline for how the editor copes with large diagrams in a real browser: opening, dragging, zooming,
 * typing and finding. Off by default; run with `pnpm perf:e2e` (desktop Chrome only).
 * Each size prints a `PERF {…}` line, and with $PERF_OUT set the results are also written there as JSON.
 */

const SIZES = [100, 500, 1000, 2000];
const results: Record<string, unknown>[] = [];

test.describe.configure({ mode: "serial" });
test.skip(!process.env.PERF, "Set PERF=1 (or run `pnpm perf:e2e`) to measure performance");

/** Records every animation frame and long task from page load, so any stretch of time can be measured. */
async function installRecorders(page: Page) {
  await page.context().addInitScript(() => {
    const w = window as unknown as { __frames: number[]; __longTasks: { start: number; duration: number }[] };
    w.__frames = [];
    w.__longTasks = [];
    const tick = (time: number) => {
      w.__frames.push(time);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__longTasks.push({ start: entry.startTime, duration: entry.duration });
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Long tasks aren't reported in this browser; frame times still are.
    }
  });
}

const now = (page: Page) => page.evaluate(() => performance.now());

/** Frame times and main-thread blocking between two `performance.now()` readings. */
async function measureSpan(page: Page, start: number, end: number) {
  return page.evaluate(
    ({ start, end }) => {
      const w = window as unknown as { __frames: number[]; __longTasks: { start: number; duration: number }[] };
      const frames = w.__frames.filter((time) => time >= start && time <= end);
      const gaps = frames.slice(1).map((time, index) => time - frames[index]).sort((a, b) => a - b);
      const pick = (q: number) => (gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * q))] : 0);
      const tasks = w.__longTasks.filter((task) => task.start >= start && task.start <= end);
      const round = (ms: number) => Math.round(ms * 10) / 10;
      return {
        ms: round(end - start),
        fps: gaps.length ? round(1000 / pick(0.5)) : 0,
        frameP95: round(pick(0.95)),
        frameMax: round(gaps.at(-1) ?? 0),
        janky: gaps.filter((gap) => gap > 50).length,
        // Time past 50 ms in each long task: how long input couldn't be answered.
        blocking: round(tasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0)),
      };
    },
    { start, end },
  );
}

for (const size of SIZES) {
  test(`${size} components per tab`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Measured on desktop Chrome only");
    test.setTimeout(300_000);
    await acceptConsent(page);
    await withoutFilePickers(page);
    await installRecorders(page);

    const diagram = stressDiagram({ componentsPerTab: size });
    const stats = stressStats(diagram);
    const tabNodes = diagram.sections[0].nodes.length;
    const path = testInfo.outputPath(`stress-${size}.json`);
    writeFileSync(path, JSON.stringify(diagram, null, 2));

    // Open: from choosing the file to every node of the first tab on the page.
    await page.goto("/diagrams");
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: /Open a diagram file/ }).click(),
    ]);
    const openStart = await now(page);
    await chooser.setFiles(path);
    await expect(page).toHaveURL(/\/editor$/);
    await expect(page.locator(".react-flow__node")).toHaveCount(tabNodes, { timeout: 120_000 });
    await page.waitForTimeout(500);
    const open = await measureSpan(page, openStart, await now(page));

    const footprint = await page.evaluate(() => ({
      domElements: document.querySelectorAll("*").length,
      heapMB: Math.round(((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0) / 1048576),
    }));

    // Drag one component across its container, 40 pointer moves.
    const block = page.locator(".react-flow__node-block").first();
    const box = (await block.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    let start = await now(page);
    for (let step = 1; step <= 40; step++) await page.mouse.move(x + step * 2, y + (step % 2), { steps: 1 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const drag = await measureSpan(page, start, await now(page));

    // Zoom in and out with the wheel over the canvas.
    const pane = (await page.locator(".react-flow__pane").boundingBox())!;
    await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
    start = await now(page);
    for (let step = 0; step < 20; step++) await page.mouse.wheel(0, step < 10 ? -120 : 120);
    await page.waitForTimeout(300);
    const zoom = await measureSpan(page, start, await now(page));

    // Rename the selected component in the details panel, 20 keystrokes. Fit first: zooming can leave the
    // component under a side panel.
    await page.locator(".react-flow__controls-fitview").click();
    await page.waitForTimeout(300);
    await block.click();
    const label = page.getByLabel("Label", { exact: true });
    await label.click();
    await label.press("End");
    start = await now(page);
    await page.keyboard.type(" renamed in a test", { delay: 0 });
    await expect(label).toHaveValue(/renamed in a test$/);
    const typing = await measureSpan(page, start, await now(page));

    // Find across every tab: from typing a query to the first result.
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+f");
    const dialog = page.getByRole("dialog", { name: "Find in diagram" });
    start = await now(page);
    await dialog.getByRole("combobox").pressSequentially("orders", { delay: 0 });
    await expect(dialog.getByRole("option").first()).toBeVisible();
    const find = await measureSpan(page, start, await now(page));

    const result = { size, ...stats, tabNodes, ...footprint, open, drag, zoom, typing, find };
    results.push(result);
    console.log(`PERF ${JSON.stringify(result)}`);
    if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, JSON.stringify(results, null, 2));
  });
}
