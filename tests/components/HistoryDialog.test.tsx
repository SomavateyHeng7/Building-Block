// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import HistoryDialog from "@/components/editor/HistoryDialog";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { useDiagramStore } from "@/lib/diagram/store";

const store = () => useDiagramStore.getState();
beforeEach(() => store().loadDiagram(createBlankDiagram("Plan")));
afterEach(cleanup);

describe("HistoryDialog", () => {
  it("saves a named checkpoint and lists it", () => {
    render(<HistoryDialog onClose={() => {}} />);
    expect(screen.getByText(/No checkpoints yet/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Checkpoint name"), { target: { value: "Approved" } });
    fireEvent.click(screen.getByRole("button", { name: "Save checkpoint" }));

    expect(store().diagram.checkpoints?.map((checkpoint) => checkpoint.name)).toEqual(["Approved"]);
    expect(screen.getByText("Approved")).toBeTruthy();
    expect((screen.getByLabelText("Checkpoint name") as HTMLInputElement).value).toBe("");
  });

  it("asks before restoring, and restores when confirmed", () => {
    store().saveCheckpoint("Before");
    store().addBlock({ x: 0, y: 0 });
    const onClose = vi.fn();
    render(<HistoryDialog onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Restore…" }));
    expect(store().diagram.sections[0].nodes).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(store().diagram.sections[0].nodes).toHaveLength(0);
    expect(onClose).toHaveBeenCalled();
  });

  it("can be backed out of without restoring", () => {
    store().saveCheckpoint("Before");
    store().addBlock({ x: 0, y: 0 });
    render(<HistoryDialog onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Restore…" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(store().diagram.sections[0].nodes).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Restore…" })).toBeTruthy();
  });

  it("shows what changed since a checkpoint without adding tabs, and comes back", () => {
    store().addBlock({ x: 0, y: 0 });
    store().updateNodeLabel(store().diagram.sections[0].nodes[0].id, "Billing");
    store().saveCheckpoint("v1");
    store().addBlock({ x: 50, y: 50 });
    store().updateNodeLabel(store().diagram.sections[0].nodes[1].id, "Orders");
    store().deleteNodes([store().diagram.sections[0].nodes[0].id]);
    render(<HistoryDialog onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "What changed since" }));
    expect(screen.getByRole("heading", { name: "Changes since \u201cv1\u201d" })).toBeTruthy();
    expect(screen.getByText("Orders")).toBeTruthy();
    expect(screen.getByText("Billing")).toBeTruthy();
    const summary = screen.getByText((_, element) => element?.tagName === "P" && /1\s*added/.test(element.textContent ?? ""));
    expect(summary.textContent).toMatch(/1\s*removed/);
    expect(store().diagram.sections).toHaveLength(1);

    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    expect(screen.getByRole("heading", { name: "Version history" })).toBeTruthy();
  });
});
