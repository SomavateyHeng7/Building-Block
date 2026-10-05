"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importDiagramFile } from "@/lib/diagram/persistence";
import { toast } from "@/lib/toast";
import { DiagramFileError } from "@/lib/diagram/validate";

/** Opens a diagram backup (.json) as a new diagram, never overwriting an existing one. */
export function ImportDiagramButton({ className, label = "Import" }: { className: string; label?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires a change.
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { diagram, fixes } = await importDiagramFile(file);
      if (fixes.length) toast.info(`Imported "${diagram.name}" with some repairs`, { details: fixes });
      else toast.success(`Imported "${diagram.name}"`);
      router.push(`/editor/${diagram.id}`);
    } catch (error) {
      toast.error(`Couldn't import "${file.name}"`, {
        details: [
          error instanceof DiagramFileError
            ? error.message
            : "Please check it's a diagram exported from Building Block.",
        ],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        title="Open a diagram file (.json) exported from Building Block"
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Importing…" : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        // Some systems report no MIME type for .json files, so match the extension too.
        accept=".json,application/json"
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
}
