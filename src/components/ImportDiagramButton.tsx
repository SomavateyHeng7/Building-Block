"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importDiagramFile } from "@/lib/diagram/persistence";
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
      if (fixes.length) {
        window.alert(`Imported "${diagram.name}" with some repairs:\n\n• ${fixes.join("\n• ")}`);
      }
      router.push(`/editor/${diagram.id}`);
    } catch (error) {
      window.alert(
        error instanceof DiagramFileError
          ? `Couldn't import "${file.name}". ${error.message}`
          : `Couldn't import "${file.name}". Please check it's a diagram exported from Building Block.`,
      );
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
