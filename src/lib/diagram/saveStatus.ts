import { useSyncExternalStore } from "react";
import { toast } from "@/lib/toast";

/** Whether the editor's last autosave reached browser storage. */
export type SaveStatus = "idle" | "saved" | "error";

let status: SaveStatus = "idle";
const listeners = new Set<() => void>();

export function setSaveStatus(next: SaveStatus): void {
  if (next === status) return;
  const wasSaving = status !== "error";
  status = next;
  if (next === "error" && wasSaving) {
    toast.error("Your diagram isn't being saved", {
      details: ["The browser refused to store it (storage full, blocked or private mode).", "Export it as JSON from the Export menu so you don't lose your work."],
      duration: 0,
    });
  }
  if (next === "saved" && !wasSaving) toast.success("Saving works again");
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribe, () => status, () => "idle" as SaveStatus);
}
