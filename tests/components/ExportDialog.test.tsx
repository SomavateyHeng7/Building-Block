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

function renderDialog(formats: ("png" | "html")[] = ["png"]) {
  const diagram = diagramWithOneComponent();
  const onExport = vi.fn();
  render(
    <ExportDialog
      diagram={diagram}
      currentViewId={diagram.sections[0].id}
      prefs={{ formats, bundle: "one", theme: "light" }}
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
});
