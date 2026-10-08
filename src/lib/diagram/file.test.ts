import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankDiagram } from "./factory";
import { isDirty, saveDiagramToFile, startDiagram, useFileStore } from "./file";
import { useDiagramStore } from "./store";

function fakeHandle(name = "plan.json") {
  const writes: string[] = [];
  const handle = {
    name,
    createWritable: async () => ({
      write: async (data: string) => void writes.push(data),
      close: async () => {},
    }),
  } as unknown as FileSystemFileHandle;
  return { handle, writes };
}

function stubWindow(extra: Record<string, unknown>) {
  vi.stubGlobal("window", extra);
}

beforeEach(() => {
  stubWindow({});
  useFileStore.setState({ opened: false, handle: null, fileName: null, saved: null, saving: false, error: false });
});
afterEach(() => vi.unstubAllGlobals());

describe("dirty tracking", () => {
  it("treats an untouched blank diagram as having nothing to lose", () => {
    startDiagram(createBlankDiagram());
    expect(isDirty()).toBe(false);
  });

  it("is dirty once a never-saved diagram has content", () => {
    startDiagram(createBlankDiagram());
    useDiagramStore.getState().addContainer({ x: 0, y: 0 });
    expect(isDirty()).toBe(true);
  });

  it("is clean for a diagram opened from a file, dirty after an edit", () => {
    startDiagram(createBlankDiagram(), { handle: null, fileName: "a.json" });
    expect(isDirty()).toBe(false);
    useDiagramStore.getState().renameDiagram("Changed");
    expect(isDirty()).toBe(true);
  });
});

describe("saveDiagramToFile", () => {
  it("asks for a location once, then reuses the file", async () => {
    const { handle, writes } = fakeHandle();
    const pick = vi.fn(async () => handle);
    stubWindow({ showOpenFilePicker: vi.fn(), showSaveFilePicker: pick });
    startDiagram(createBlankDiagram());
    useDiagramStore.getState().addContainer({ x: 0, y: 0 });

    expect(await saveDiagramToFile()).toBe(true);
    expect(isDirty()).toBe(false);
    expect(useFileStore.getState().fileName).toBe("plan.json");

    useDiagramStore.getState().addBlock({ x: 10, y: 10 });
    expect(isDirty()).toBe(true);
    expect(await saveDiagramToFile()).toBe(true);

    expect(pick).toHaveBeenCalledTimes(1);
    expect(writes).toHaveLength(2);
    expect(JSON.parse(writes[1]).sections[0].nodes).toHaveLength(2);
  });

  it("Save as always asks again", async () => {
    const pick = vi.fn(async () => fakeHandle().handle);
    stubWindow({ showOpenFilePicker: vi.fn(), showSaveFilePicker: pick });
    startDiagram(createBlankDiagram());
    await saveDiagramToFile();
    await saveDiagramToFile({ saveAs: true });
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it("stays dirty when the user cancels the picker", async () => {
    const cancel = vi.fn(async () => {
      throw new DOMException("cancelled", "AbortError");
    });
    stubWindow({ showOpenFilePicker: vi.fn(), showSaveFilePicker: cancel });
    startDiagram(createBlankDiagram());
    useDiagramStore.getState().addContainer({ x: 0, y: 0 });
    expect(await saveDiagramToFile()).toBe(false);
    expect(isDirty()).toBe(true);
    expect(useFileStore.getState().error).toBe(false);
  });

  it("reports a failed write and stays dirty", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = { name: "x.json", createWritable: async () => { throw new Error("read-only"); } } as unknown as FileSystemFileHandle;
    stubWindow({ showOpenFilePicker: vi.fn(), showSaveFilePicker: async () => failing });
    startDiagram(createBlankDiagram());
    useDiagramStore.getState().addContainer({ x: 0, y: 0 });
    expect(await saveDiagramToFile()).toBe(false);
    expect(useFileStore.getState().error).toBe(true);
    expect(isDirty()).toBe(true);
  });
});
