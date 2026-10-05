import { useSyncExternalStore } from "react";

/** Whether the editor's last autosave reached browser storage. */
export type SaveStatus = "idle" | "saved" | "error";

let status: SaveStatus = "idle";
const listeners = new Set<() => void>();

export function setSaveStatus(next: SaveStatus): void {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribe, () => status, () => "idle" as SaveStatus);
}
