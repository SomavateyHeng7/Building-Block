// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ExportDialog from "@/components/editor/ExportDialog";
import { createBlankDiagram } from "@/lib/diagram/factory";
import type { Diagram, DiagramNode } from "@/lib/diagram/types";

afterEach(cleanup);

function diagramWithOneComponent(): Diagram {
  const node: DiagramNode = {
    id: "a",
    type: "block",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 50 },
    data: { kind: "block", label: "Web", containerId: null },
  };
  const diagram = createBlankDiagram("Plan");
  diagram.sections[0] = { ...diagram.sections[0], nodes: [node] };
  return diagram;
}

function diagramWithLegendColour(): Diagram {
  const diagram = diagramWithOneComponent();
  const [node] = diagram.sections[0].nodes;
  diagram.legend = [{ key: "new", label: "New", color: "#22c55e" }];
  diagram.sections[0].nodes = [{ ...node, data: { ...node.data, colorKey: "new" } } as DiagramNode];
  return diagram;
}

function renderDialog(formats: ("png" | "html")[] = ["png"], diagram = diagramWithLegendColour(), markedViewIds?: string[]) {
  const onExport = vi.fn();
  render(
    <ExportDialog
      diagram={diagram}
      currentViewId={diagram.sections[0].id}
      prefs={{ formats, bundle: "one", theme: "light" }}
      markedViewIds={markedViewIds}
      onCancel={() => {}}
      onExport={onExport}
    />,
  );
  return { onExport };
}

describe("ExportDialog", () => {
  it("offers the interactive viewer and says which file it will make", () => {
    renderDialog();
    expect(screen.getByText("Download plan.png", { selector: "button" })).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: /Interactive viewer/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /PNG image/ }));
    expect(screen.getByText("Download plan.html", { selector: "button" })).toBeTruthy();
  });

  it("hands the chosen formats to onExport", () => {
    const { onExport } = renderDialog(["html"]);
    fireEvent.click(screen.getByRole("button", { name: "Download plan.html" }));
    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ formats: ["html"], bundle: "one", theme: "light" }));
  });

  it("won't download with no format chosen", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("checkbox", { name: /PNG image/ }));
    expect(screen.getByText("Choose at least one format.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Download" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("can leave the legend out of pictures", () => {
    const { onExport } = renderDialog();
    const legend = screen.getByRole("checkbox", { name: /Include legend/ }) as HTMLInputElement;
    expect(legend.checked).toBe(true);
    fireEvent.click(legend);
    fireEvent.click(screen.getByRole("button", { name: "Download plan.png" }));
    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ legend: false }));
  });

  it("keeps code and list formats under More formats", () => {
    renderDialog();
    expect(screen.queryByRole("checkbox", { name: /Mermaid/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /More formats/ }));
    expect(screen.getByRole("checkbox", { name: /Mermaid/ })).toBeTruthy();
  });

  it("greys out the legend when nothing in the picture uses a legend colour", () => {
    renderDialog(["png"], diagramWithOneComponent());
    const legend = screen.getByRole("checkbox", { name: /Include legend/ }) as HTMLInputElement;
    expect(legend.disabled).toBe(true);
    expect(legend.checked).toBe(false);
    expect(screen.getByText("Nothing here uses a legend colour yet")).toBeTruthy();
  });

  it("offers the legend for change marks even without legend colours", () => {
    const diagram = diagramWithOneComponent();
    renderDialog(["png"], diagram, [diagram.sections[0].id]);
    expect((screen.getByRole("checkbox", { name: /Include legend/ }) as HTMLInputElement).disabled).toBe(false);
  });

  it("moves between Light and Dark with the arrow keys, with one Tab stop", () => {
    const { onExport } = renderDialog();
    const group = screen.getByRole("radiogroup", { name: "Picture style" });
    const light = screen.getByRole("radio", { name: "Light" });
    const dark = screen.getByRole("radio", { name: "Dark" });
    expect(light.tabIndex).toBe(0);
    expect(dark.tabIndex).toBe(-1);
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(dark.getAttribute("aria-checked")).toBe("true");
    expect(dark.tabIndex).toBe(0);
    expect(document.activeElement).toBe(dark);
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(light.getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(group, { key: "End" });
    fireEvent.click(screen.getByRole("button", { name: "Download plan.png" }));
    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark" }));
  });
});
