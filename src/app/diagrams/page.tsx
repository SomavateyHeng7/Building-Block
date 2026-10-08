"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { openDiagramFromDevice, startDiagram, supportsFilePicker } from "@/lib/diagram/file";
import { downloadLegacyItem, readLegacyItems, removeLegacyItems, type LegacyItem } from "@/lib/diagram/legacy";
import { toast } from "@/lib/toast";

const noopSubscribe = () => () => {};
const NO_ITEMS: LegacyItem[] = [];
let legacySnapshot: LegacyItem[] | null = null;

/** Read once per page load; a stable reference keeps useSyncExternalStore from looping. */
function getLegacySnapshot(): LegacyItem[] {
  legacySnapshot ??= readLegacyItems();
  return legacySnapshot;
}

export default function StartPage() {
  const router = useRouter();
  const found = useSyncExternalStore(noopSubscribe, getLegacySnapshot, () => NO_ITEMS);
  const [removed, setRemoved] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [opening, setOpening] = useState(false);
  const legacy = removed ? NO_ITEMS : found;

  function startBlank() {
    startDiagram(createBlankDiagram());
    router.push("/editor");
  }

  async function openFile() {
    setOpening(true);
    try {
      if (await openDiagramFromDevice()) router.push("/editor");
    } finally {
      setOpening(false);
    }
  }

  const pill = "rounded-full px-6 py-3 text-sm font-medium transition-colors";
  const outline = `${pill} border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900`;

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          <Link href="/">Building Block</Link>
        </h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          Drag containers and components onto a canvas to build architecture diagrams, then
          export them as PNG or PDF.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className={`${pill} bg-foreground text-background hover:bg-[#383838] dark:hover:bg-[#ccc]`} onClick={startBlank}>
            New diagram
          </button>
          <button type="button" className={outline} disabled={opening} onClick={() => void openFile()}>
            {opening ? "Opening…" : "Open file"}
          </button>
          <Link href="/templates" className={outline}>
            Browse templates
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Your diagrams are your files</h2>
        <p className="mt-1">
          Building Block keeps nothing: no account, no server, and no copy in this browser. A diagram is a{" "}
          <code className="font-mono text-xs">.json</code> file on your device, so use <span className="font-medium">Save</span> to
          keep your work and <span className="font-medium">Open file</span> to carry on.{" "}
          {supportsFilePicker()
            ? "This browser saves straight back to the file you chose."
            : "This browser can't save over a file, so Save downloads a new copy each time. Chrome or Edge can save in place."}
        </p>
      </div>

      {legacy.length > 0 && (
        <div role="region" aria-label="Diagrams from an earlier version" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
          <h2 className="font-semibold">Diagrams from an earlier version are still in this browser</h2>
          <p className="mt-1">
            Earlier versions stored diagrams here. They can no longer be opened from the app, so download each one as a file. Then remove
            the browser copies, or leave them alone.
          </p>
          <ul className="mt-3 flex flex-col divide-y divide-amber-200 dark:divide-amber-900">
            {legacy.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">
                  {item.name} <span className="text-xs opacity-70">({item.kind})</span>
                </span>
                <button type="button" className="shrink-0 rounded border border-amber-400 px-2.5 py-1 text-xs font-medium hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900" onClick={() => downloadLegacyItem(item)}>
                  Download
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-amber-400 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
              onClick={async () => {
                for (const item of legacy) {
                  downloadLegacyItem(item);
                  // Browsers drop downloads fired back to back.
                  await new Promise((resolve) => setTimeout(resolve, 300));
                }
              }}
            >
              Download all
            </button>
            {confirmingRemove ? (
              <button
                type="button"
                autoFocus
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                onClick={() => {
                  removeLegacyItems();
                  setRemoved(true);
                  toast.success("Removed the old copies from this browser");
                }}
                onBlur={() => setConfirmingRemove(false)}
              >
                Permanently remove them?
              </button>
            ) : (
              <button
                type="button"
                className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                onClick={() => setConfirmingRemove(true)}
              >
                Remove from this browser
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
