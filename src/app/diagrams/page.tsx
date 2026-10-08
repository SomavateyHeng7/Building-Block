"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type DragEvent, type ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle, useMounted } from "@/components/theme-toggle";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { openDiagramFromDevice, openDroppedDiagram, startDiagram, supportsFilePicker } from "@/lib/diagram/file";
import { downloadLegacyItem, readLegacyItems, removeLegacyItems, type LegacyItem } from "@/lib/diagram/legacy";
import { toast } from "@/lib/toast";
import { templates } from "@/templates";

const noopSubscribe = () => () => {};
const NO_ITEMS: LegacyItem[] = [];
let legacySnapshot: LegacyItem[] | null = null;

/** Read once per page load; a stable reference keeps useSyncExternalStore from looping. */
function getLegacySnapshot(): LegacyItem[] {
  legacySnapshot ??= readLegacyItems();
  return legacySnapshot;
}

const ICONS = {
  plus: "M12 5v14M5 12h14",
  folder: "M3 7h6l2 2h10v10H3zM3 7V5h6",
  template: "M4 4h16v5H4zM4 13h7v7H4zM15 13h5v7h-5z",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  arrow: "M5 12h14M13 6l6 6-6 6",
};

function Icon({ path, className = "h-5 w-5" }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  );
}

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer.types.includes("Files");
}

const CARD =
  "group flex flex-col gap-3 rounded-xl border p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-wait disabled:opacity-60 dark:focus-visible:outline-zinc-100";
const CARD_PLAIN = `${CARD} border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900`;
const ICON_BOX = "flex h-9 w-9 items-center justify-center rounded-lg";

function ActionCard({
  icon,
  title,
  body,
  primary = false,
  disabled,
  onClick,
  children,
}: {
  icon: string;
  title: string;
  body: string;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={primary ? `${CARD} border-transparent bg-foreground text-background hover:bg-[#383838] dark:hover:bg-[#ccc]` : CARD_PLAIN}
    >
      <span className={`${ICON_BOX} ${primary ? "bg-background/15" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}>
        <Icon path={icon} />
      </span>
      <span className="flex items-center gap-1.5 font-semibold">
        {title}
        <Icon path={ICONS.arrow} className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </span>
      <span className={`text-sm ${primary ? "opacity-75" : "text-zinc-600 dark:text-zinc-400"}`}>{body}</span>
      {children}
    </button>
  );
}

export default function StartPage() {
  const router = useRouter();
  const found = useSyncExternalStore(noopSubscribe, getLegacySnapshot, () => NO_ITEMS);
  const [removed, setRemoved] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [opening, setOpening] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Which browser this is is only known on the client.
  const mounted = useMounted();
  const legacy = removed ? NO_ITEMS : found;
  const starterTemplates = templates.filter((template) => template.id !== "blank");

  function startBlank() {
    startDiagram(createBlankDiagram());
    router.push("/editor");
  }

  function startTemplate(id: string) {
    const template = templates.find((candidate) => candidate.id === id);
    if (!template) return;
    startDiagram(template.build());
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

  async function dropFile(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    // Starts reading synchronously, while the browser still allows access to the dropped file.
    const opened = openDroppedDiagram(event.dataTransfer);
    setOpening(true);
    try {
      if (await opened) router.push("/editor");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div
      className="flex min-h-full w-full flex-1 flex-col"
      onDragEnter={(event) => {
        if (hasFiles(event)) setDragging(true);
      }}
    >
      <header className="border-b border-zinc-200/70 dark:border-zinc-800/70">
        <nav className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <LogoMark className="h-6 w-6" />
            Building Block
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-12 sm:px-6 sm:py-16">
        <section className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Start a diagram</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">Begin with an empty canvas, or pick up where you left off.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ActionCard primary icon={ICONS.plus} title="New blank diagram" body="An empty canvas with the default colour legend." onClick={startBlank} />
            <ActionCard
              icon={ICONS.folder}
              title={opening ? "Opening…" : "Open a diagram file"}
              body="Carry on with a .json file you saved from Building Block."
              disabled={opening}
              onClick={() => void openFile()}
            >
              <span className="mt-auto text-xs text-zinc-500">Or drop the file anywhere on this page</span>
            </ActionCard>
          </div>
        </section>

        {starterTemplates.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Start from a template</h2>
              <Link href="/templates" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                All templates
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {starterTemplates.map((template) => (
                <ActionCard key={template.id} icon={ICONS.template} title={template.name} body={template.description} onClick={() => startTemplate(template.id)} />
              ))}
            </div>
          </section>
        )}

        <section className="flex gap-3 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
          <span className={`${ICON_BOX} shrink-0 bg-white text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`}>
            <Icon path={ICONS.lock} />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Your diagrams are your files</h2>
            <p className="mt-1">
              No account, no server, and no copy kept in this browser. Use <span className="font-medium">Save</span> in the editor to
              keep your work as a <code className="font-mono text-xs">.json</code> file, and open it here next time.{" "}
              {mounted &&
                (supportsFilePicker()
                  ? "This browser saves straight back to the file you opened."
                  : "This browser can't save over a file, so each Save downloads a new copy. Chrome or Edge can save in place.")}
            </p>
          </div>
        </section>

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
      </main>

      {dragging && (
        // Covers the page while a file is dragged over it, so leaving it means the drag left the window.
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => void dropFile(event)}
        >
          <div className="pointer-events-none flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-400 p-10 text-center dark:border-zinc-600">
            <Icon path={ICONS.folder} className="h-8 w-8 text-zinc-500" />
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">Drop to open your diagram</p>
            <p className="text-sm text-zinc-500">A .json file saved from Building Block</p>
          </div>
        </div>
      )}
    </div>
  );
}
