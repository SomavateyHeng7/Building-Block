// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CommandPalette, { matchCommands, type PaletteCommand } from "@/components/editor/dialogs/CommandPalette";

// jsdom has no layout, so no scrolling.
Element.prototype.scrollIntoView = () => {};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const command = (id: string, label: string, extra: Partial<PaletteCommand> = {}): PaletteCommand => ({
  id,
  label,
  group: "File",
  run: () => {},
  ...extra,
});

describe("matchCommands", () => {
  const list = [
    command("export", "Export…", { words: "download png" }),
    command("copy", "Copy tab as image", { words: "clipboard png" }),
    command("present", "Present full screen", { group: "View" }),
  ];

  it("lists everything for an empty query", () => {
    expect(matchCommands(list, "  ")).toEqual(list);
  });

  it("matches every word against the name, group and extra words", () => {
    expect(matchCommands(list, "png").map((c) => c.id)).toEqual(["export", "copy"]);
    expect(matchCommands(list, "view full").map((c) => c.id)).toEqual(["present"]);
    expect(matchCommands(list, "zzz")).toEqual([]);
  });

  it("puts names that start with the query first", () => {
    expect(matchCommands(list, "pr").map((c) => c.id)[0]).toBe("present");
    expect(matchCommands([command("a", "Add export note"), command("b", "Export…")], "export").map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("CommandPalette", () => {
  it("runs the chosen command with Enter once the palette has closed", () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette commands={[command("a", "Alpha"), command("b", "Beta", { run })]} onClose={onClose} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "bet" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onClose).toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(run).toHaveBeenCalledOnce();
  });

  it("runs an immediate command at once, while the key press is still current", () => {
    const run = vi.fn();
    render(<CommandPalette commands={[command("copy", "Copy as image", { run, immediate: true })]} onClose={() => {}} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(run).toHaveBeenCalledOnce();
  });

  it("moves with the arrow keys and closes with Escape", () => {
    const run = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette commands={[command("a", "Alpha"), command("b", "Beta", { run, immediate: true })]} onClose={onClose} />);
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(run).toHaveBeenCalledOnce();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("says when nothing matches", () => {
    render(<CommandPalette commands={[command("a", "Alpha")]} onClose={() => {}} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "qq" } });
    expect(screen.getByText("No command matches “qq”.")).toBeTruthy();
  });
});
