/** The editor's title until a diagram is open (also its route metadata). */
export const EDITOR_TITLE = "Editor · Building Block";

/**
 * The browser tab's title while a diagram is open: its name, with a dot in front while there are unsaved
 * changes, so several open diagrams can be told apart (and the unsaved one spotted) from the tab bar.
 */
export function editorTitle(name: string, dirty: boolean): string {
  const trimmed = name.trim();
  return `${dirty ? "• " : ""}${trimmed ? `${trimmed} · Building Block` : EDITOR_TITLE}`;
}
