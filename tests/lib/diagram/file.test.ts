import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { fileBaseName, isDirty, openDiagramFromDevice, saveDiagramToFile, startDiagram, useFileStore } from "@/lib/diagram/file";
import { useDiagramStore } from "@/lib/diagram/store";

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
  useFileStore.setState({ opened: false, handle: null, fileName: null, saved: null, saving: false, error: false, savedAt: null });
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

  it("stays clean when only the open tab changes", () => {
    const diagram = createBlankDiagram();
    diagram.sections.push({ id: "second", name: "Target", nodes: [] });
    startDiagram(diagram, { handle: null, fileName: "a.json" });
    useDiagramStore.getState().setActiveSection("second");
    expect(isDirty()).toBe(false);
    useDiagramStore.getState().addContainer({ x: 0, y: 0 });
    expect(isDirty()).toBe(true);
  });
});

describe("saveDiagramToFile without the file picker", () => {
  it("downloads a copy, marks it saved and records when", async () => {
    const click = vi.fn();
    stubWindow({});
    vi.stubGlobal("document", { createElement: () => ({ click }) });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    startDiagram(createBlankDiagram());
    useDiagramStore.getState().addContainer({ x: 0, y: 0 });
    expect(useFileStore.getState().savedAt).toBeNull();

    expect(await saveDiagramToFile()).toBe(true);

    expect(click).toHaveBeenCalledTimes(1);
    expect(isDirty()).toBe(false);
    expect(useFileStore.getState().savedAt).toBeGreaterThan(0);
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

describe("undo and the saved state", () => {
  it("is clean again after undoing back to what was saved", () => {
    startDiagram(createBlankDiagram(), { handle: null, fileName: "a.json" });
    useDiagramStore.getState().addContainer({ x: 0, y: 0 });
    expect(isDirty()).toBe(true);
    useDiagramStore.getState().undo();
    expect(isDirty()).toBe(false);
    useDiagramStore.getState().redo();
    expect(isDirty()).toBe(true);
  });
});

describe("fileBaseName", () => {
  it.each([
    ["L0 Architecture", "l0-architecture"],
    ["Payments/Orders: v2?", "payments-orders-v2"],
    ["Plan — Current", "plan-current"],
    ['a<b>c|d*e"f\\g', "a-b-c-d-e-f-g"],
    ["...hidden.", "hidden"],
    ["CON", "con-diagram"],
    ["  ", "diagram"],
    ["Café Ü", "café-ü"],
  ])("%j → %j", (name, expected) => {
    expect(fileBaseName(name)).toBe(expected);
  });
});

describe("opening a file as a copy", () => {
  function pickerReturning(diagram: unknown) {
    const text = JSON.stringify(diagram);
    const handle = { name: "layout.json", getFile: async () => ({ name: "layout.json", size: text.length, text: async () => text }) };
    stubWindow({ showOpenFilePicker: vi.fn(async () => [handle]), showSaveFilePicker: vi.fn() });
  }

  it("opens it as a new, unsaved diagram, so Save never writes over the file", async () => {
    const original = createBlankDiagram("Layout");
    original.sections[0].nodes = [
      { id: "a", type: "block", position: { x: 0, y: 0 }, size: { width: 100, height: 50 }, data: { kind: "block", label: "Web", containerId: null } },
    ];
    pickerReturning(original);

    const opened = await openDiagramFromDevice({ asCopy: true });

    expect(opened?.id).not.toBe(original.id);
    expect(useFileStore.getState()).toMatchObject({ opened: true, handle: null, fileName: null, saved: null });
    expect(isDirty()).toBe(true);
  });

  it("keeps the file as the place to save when opened normally", async () => {
    const original = createBlankDiagram("Layout");
    pickerReturning(original);
    const opened = await openDiagramFromDevice();
    expect(opened?.id).toBe(original.id);
    expect(useFileStore.getState().fileName).toBe("layout.json");
    expect(useFileStore.getState().handle).not.toBeNull();
  });
});
