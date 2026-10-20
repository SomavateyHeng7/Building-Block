"use client";

import { useState, type ReactNode } from "react";
import { useDiagramStore } from "@/lib/diagram/store";
import { isDirty, saveDiagramToFile, supportsFilePicker, useFileStore } from "@/lib/diagram/file";
import { clearRecoveryCopy } from "@/lib/diagram/recovery";
import UnsavedChangesDialog from "./UnsavedChangesDialog";

interface GuardOptions {
  /**
   * The action shows a file picker. Browsers only allow that straight from a click, so if saving first
   * needed its own picker, the dialog asks for one more click (labelled `continueLabel`) instead.
   */
  picker?: { continueLabel: string; next: string };
}

interface Pending extends GuardOptions {
  action: () => void;
}

/**
 * Anything that replaces the open diagram goes through `guard`: it runs at once when nothing would be
 * lost, otherwise after the user chooses Save / Don't save. Render `dialog` somewhere on the page.
 */
export function useUnsavedGuard(): { guard: (action: () => void, options?: GuardOptions) => void; dialog: ReactNode } {
  const name = useDiagramStore((state) => state.diagram.name);
  const hasFile = useFileStore((state) => state.handle !== null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);

  function guard(action: () => void, options: GuardOptions = {}) {
    if (!isDirty()) return action();
    setSavedTo(null);
    setPending({ action, ...options });
  }

  function close() {
    setPending(null);
    setSavedTo(null);
  }

  function run(current: Pending) {
    close();
    current.action();
  }

  const dialog = pending && (
    <UnsavedChangesDialog
      name={name}
      needsLocation={!hasFile}
      saved={savedTo && pending.picker ? { fileName: savedTo, ...pending.picker } : null}
      onCancel={close}
      onDiscard={() => {
        // Deliberately thrown away, so its recovery copy goes too.
        clearRecoveryCopy(useDiagramStore.getState().diagram.id);
        run(pending);
      }}
      onContinue={() => run(pending)}
      onSave={async () => {
        const savePicksLocation = supportsFilePicker() && !useFileStore.getState().handle;
        if (!(await saveDiagramToFile())) return;
        if (pending.picker && savePicksLocation) setSavedTo(useFileStore.getState().fileName ?? "your file");
        else run(pending);
      }}
    />
  );

  return { guard, dialog };
}
