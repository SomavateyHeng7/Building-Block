import { expect, test } from "@playwright/test";
import { acceptConsent, openTemplate } from "./helpers";

const DRAWIO = `<mxfile><diagram name="Platform"><mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="lane" value="Core Systems" style="swimlane;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="320" height="200" as="geometry"/></mxCell>
  <mxCell id="a" value="Orders" style="fillColor=#dae8fc;" vertex="1" parent="lane"><mxGeometry x="20" y="40" width="120" height="60" as="geometry"/></mxCell>
  <mxCell id="b" value="Payments" style="fillColor=#d5e8d4;" vertex="1" parent="1"><mxGeometry x="500" y="80" width="120" height="60" as="geometry"/></mxCell>
  <mxCell id="e" value="Charge" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;

test("a pasted Mermaid sequence diagram opens as a new diagram", async ({ page }) => {
  await acceptConsent(page);
  await page.goto("/diagrams");
  await page.getByRole("button", { name: /Import from draw.io or Mermaid/ }).click();
  const dialog = page.getByRole("dialog", { name: "Import from draw.io or Mermaid" });
  await dialog.getByRole("textbox").fill("sequenceDiagram\n  title Login\n  actor User\n  User->>App: Sign in\n  App-->>User: Welcome");
  await dialog.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByRole("status").getByText('Imported "Login"')).toBeVisible();
  // Phones open in view mode; the sheet shows either way.
  await expect(page.locator(".bb-sequence-sheet").getByRole("button", { name: "User (person)" })).toBeVisible();
});

test("a draw.io file is added as a tab, with its shapes, container, colours and arrow", async ({ page, isMobile }) => {
  test.skip(isMobile, "The File menu's import is checked on a wide screen");
  await acceptConsent(page);
  await openTemplate(page);
  const tabs = await page.getByRole("tab").count();
  await page.getByRole("button", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Import draw.io or Mermaid…" }).click();
  const dialog = page.getByRole("dialog", { name: "Import from draw.io or Mermaid" });
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), dialog.getByRole("button", { name: "Choose a file…" }).click()]);
  await chooser.setFiles({ name: "platform.drawio", mimeType: "application/xml", buffer: Buffer.from(DRAWIO) });

  await expect(page.getByRole("tab")).toHaveCount(tabs + 1);
  await expect(page.getByRole("tab", { name: "Platform" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".react-flow__node-container")).toHaveCount(1);
  await expect(page.locator(".react-flow__node-block")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Imported #dae8fc\. Double-click/ })).toBeVisible();

  // Undo takes the import back out.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByRole("tab")).toHaveCount(tabs);
});

test("a flowchart gets a clear message pointing to draw.io", async ({ page }) => {
  await acceptConsent(page);
  await page.goto("/diagrams");
  await page.getByRole("button", { name: /Import from draw.io or Mermaid/ }).click();
  const dialog = page.getByRole("dialog", { name: "Import from draw.io or Mermaid" });
  await dialog.getByRole("textbox").fill("flowchart LR\n  A --> B");
  await dialog.getByRole("button", { name: "Open" }).click();
  await expect(dialog.getByRole("alert")).toContainText("import a draw.io file");
});
