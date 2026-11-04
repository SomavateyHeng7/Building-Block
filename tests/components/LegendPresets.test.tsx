// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import LegendPanel from "@/components/editor/LegendPanel";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { useDiagramStore } from "@/lib/diagram/store";

beforeEach(() => useDiagramStore.getState().loadDiagram({ ...createBlankDiagram(), legend: [] }));
afterEach(cleanup);

const labels = () => useDiagramStore.getState().diagram.legend.map((entry) => entry.label);

describe("legend presets", () => {
  it("adds a standard's categories from the Reuse menu, then closes it", () => {
    render(<LegendPanel />);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reuse" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /C4 model/ }));

    expect(labels()).toEqual(["Person", "Software system", "External software system", "Container", "Component"]);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("doesn't add a preset's categories twice", () => {
    render(<LegendPanel />);
    for (let attempt = 0; attempt < 2; attempt++) {
      fireEvent.click(screen.getByRole("button", { name: "Reuse" }));
      fireEvent.click(screen.getByRole("menuitem", { name: /ArchiMate/ }));
    }
    expect(labels()).toHaveLength(6);
  });

  it("moves through the menu with the arrow keys and returns focus to the button on Escape", () => {
    render(<LegendPanel />);
    const button = screen.getByRole("button", { name: "Reuse" });
    fireEvent.click(button);

    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: "ArrowUp" });
    fireEvent.keyDown(items[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(items.filter((item) => !(item as HTMLButtonElement).disabled).at(-1));

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("closes when the pointer goes elsewhere", () => {
    render(<LegendPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Reuse" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
