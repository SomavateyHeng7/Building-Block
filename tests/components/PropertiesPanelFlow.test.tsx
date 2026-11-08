// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import PropertiesPanel from "@/components/editor/PropertiesPanel";
import { getTemplate } from "@/templates";
import { useDiagramStore } from "@/lib/diagram/store";

afterEach(cleanup);

function open() {
  useDiagramStore.getState().loadDiagram(getTemplate("three-tier")!.build());
  useDiagramStore.getState().setSelection([]);
  render(
    <ReactFlowProvider>
      <PropertiesPanel />
    </ReactFlowProvider>,
  );
}

describe("PropertiesPanel with nothing selected", () => {
  it("offers the flow controls, and Number in flow order numbers the connections", () => {
    open();
    expect(screen.getByRole("button", { name: "Tidy left to right" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tidy top to bottom" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Number in flow order" }));
    const { diagram } = useDiagramStore.getState();
    expect(diagram.numberConnections).toBe(true);
    expect(diagram.sections[0].edges?.every((edge) => typeof edge.step === "number")).toBe(true);
  });

  it("has a switch for step numbers", () => {
    open();
    fireEvent.click(screen.getByRole("switch", { name: /Show step numbers/ }));
    expect(useDiagramStore.getState().diagram.numberConnections).toBe(true);
  });
});
