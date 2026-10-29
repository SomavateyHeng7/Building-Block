// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import HintsDialog from "@/components/editor/HintsDialog";
import { goTo } from "@/components/editor/canvasFocus";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { useDiagramStore } from "@/lib/diagram/store";
import type { DiagramNode } from "@/lib/diagram/types";

vi.mock("@/components/editor/canvasFocus", () => ({ goTo: vi.fn() }));

function block(id: string, label: string, owner?: string): DiagramNode {
  return {
    id,
    type: "block",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 50 },
    data: { kind: "block", label, containerId: null, ...(owner ? { owner } : {}) },
  };
}

function open(nodes: DiagramNode[], edges: { id: string; source: string; target: string; protocol?: string }[] = []) {
  const diagram = createBlankDiagram();
  diagram.sections[0] = { ...diagram.sections[0], nodes, edges };
  useDiagramStore.getState().loadDiagram(diagram);
  return diagram.sections[0].id;
}

beforeEach(() => vi.mocked(goTo).mockClear());
afterEach(cleanup);

describe("HintsDialog", () => {
  it("says there is nothing to flag for a complete diagram", () => {
    open([block("a", "Web", "Team A"), block("b", "API", "Team B")], [{ id: "e", source: "a", target: "b", protocol: "REST" }]);
    render(<HintsDialog onClose={() => {}} />);
    expect(screen.getByText("Nothing to flag.")).toBeTruthy();
  });

  it("groups what is worth a look, and opens the item that is picked", () => {
    const sectionId = open([block("a", "Web", "Team A"), block("b", "API")], [{ id: "e", source: "a", target: "b" }]);
    const onClose = vi.fn();
    render(<HintsDialog onClose={onClose} />);

    expect(screen.getByText(/2 things worth a look/)).toBeTruthy();
    expect(screen.getByText(/Connections with no protocol · 1/)).toBeTruthy();
    expect(screen.getByText(/Components with no owner · 1/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Web → API/ }));
    expect(onClose).toHaveBeenCalled();
    expect(goTo).toHaveBeenCalledWith({ sectionId, detailId: undefined, kind: "edge", id: "e" });
  });

  it("closes on Escape", () => {
    open([]);
    const onClose = vi.fn();
    render(<HintsDialog onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab inside, and gives focus back to what opened it", () => {
    open([]);
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const { unmount } = render(<HintsDialog onClose={() => {}} />);
    const close = screen.getByRole("button", { name: "Close" });
    expect(document.activeElement).toBe(close);
    // The only control: Tab (either way) stays on it instead of leaving the dialog.
    fireEvent.keyDown(close, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(close);

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
