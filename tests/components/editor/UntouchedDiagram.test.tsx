// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { startDiagram, useUntouchedNewDiagram } from "@/lib/diagram/persistence/file";
import { useDiagramStore } from "@/lib/diagram/store";
import { getTemplate } from "@/templates";

afterEach(cleanup);

describe("useUntouchedNewDiagram", () => {
  it("is true for a template nothing has been done to, and false after the first edit", () => {
    act(() => startDiagram(getTemplate("three-tier")!.build()));
    const { result } = renderHook(() => useUntouchedNewDiagram());
    expect(result.current).toBe(true);
    act(() => useDiagramStore.getState().renameDiagram("My system"));
    expect(result.current).toBe(false);
  });

  it("stays false after an undo, since the undo can still be redone", () => {
    act(() => startDiagram(getTemplate("three-tier")!.build()));
    const { result } = renderHook(() => useUntouchedNewDiagram());
    act(() => useDiagramStore.getState().renameDiagram("My system"));
    expect(result.current).toBe(false);
    act(() => useDiagramStore.getState().undo());
    expect(result.current).toBe(false);
  });

  it("is false for a diagram opened from a file, however untouched", () => {
    act(() => startDiagram(getTemplate("three-tier")!.build(), { handle: null, fileName: "mine.json" }));
    const { result } = renderHook(() => useUntouchedNewDiagram());
    expect(result.current).toBe(false);
  });
});
