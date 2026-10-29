// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import Announcer from "@/components/editor/Announcer";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { useDiagramStore } from "@/lib/diagram/store";

const store = () => useDiagramStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  store().loadDiagram(createBlankDiagram());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const settle = () => act(() => void vi.advanceTimersByTime(500));

describe("Announcer", () => {
  it("is a polite live region, empty until something happens", () => {
    render(<Announcer />);
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toBe("");
  });

  it("says what was added and what is selected", () => {
    render(<Announcer />);
    act(() => store().addBlock({ x: 0, y: 0 }));
    settle();
    expect(screen.getByRole("status").textContent).toMatch(/^Added New Block\. 1 item here\.$/);

    const id = store().diagram.sections[0].nodes[0].id;
    act(() => store().setSelection([]));
    settle();
    expect(screen.getByRole("status").textContent).toBe("Selection cleared.");

    act(() => store().setSelection([id]));
    settle();
    expect(screen.getByRole("status").textContent).toBe("New Block, component. Category: Product Components. 0 connections.");
  });
});
