import { describe, expect, it, vi } from "vitest";
import { hasCommand, registerCommands, runCommand } from "@/components/editor/shared/commands";

describe("editor commands", () => {
  it("runs what is registered and reports what isn't", () => {
    const run = vi.fn();
    const remove = registerCommands({ export: run });
    expect(hasCommand("export")).toBe(true);
    expect(runCommand("export")).toBe(true);
    expect(run).toHaveBeenCalledOnce();
    remove();
    expect(hasCommand("export")).toBe(false);
    expect(runCommand("export")).toBe(false);
  });

  it("lets a newer registration replace an older one without the old cleanup removing it", () => {
    const first = vi.fn();
    const second = vi.fn();
    const removeFirst = registerCommands({ save: first });
    registerCommands({ save: second });
    removeFirst();
    runCommand("save");
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });
});
