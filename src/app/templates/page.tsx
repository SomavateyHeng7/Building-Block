"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { templates } from "@/templates";
import { openDiagramFromDevice, startDiagram } from "@/lib/diagram/file";
import { ThemeToggle } from "@/components/theme-toggle";
import TemplatePreview from "@/components/TemplatePreview";
import { useUnsavedGuard } from "@/components/editor/useUnsavedGuard";

const CARD =
  "flex h-full flex-col items-start justify-start rounded-lg border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus-visible:outline-zinc-100";

export default function TemplatesPage() {
  const router = useRouter();
  // A diagram can still be open in memory, e.g. after the browser's Back button from the editor.
  const { guard, dialog: unsavedDialog } = useUnsavedGuard();

  function applyTemplate(id: string) {
    const template = templates.find((candidate) => candidate.id === id);
    if (!template) return;
    guard(() => {
      startDiagram(template.build());
      router.push("/editor");
    });
  }

  function startFromFile() {
    guard(
      async () => {
        if (await openDiagramFromDevice({ asCopy: true })) router.push("/editor");
      },
      { picker: { continueLabel: "Choose a file…", next: "Now choose the file to start from." } },
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex items-center justify-between">
        <Link href="/diagrams" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Start
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((template) => (
          <button type="button" key={template.id} onClick={() => applyTemplate(template.id)} className={CARD}>
            <div className="mb-3 w-full">
              <TemplatePreview build={template.build} name={template.name} />
            </div>
            <h2 className="font-medium text-zinc-900 dark:text-zinc-100">{template.name}</h2>
            <p className="mt-1 text-sm text-zinc-500">{template.description}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Your own template</h2>
        <p className="text-sm text-zinc-500">
          Save a diagram with your layout and legend as a file. Start from it here to get a copy: the file itself is never
          changed, and Save asks where to put the new diagram.
        </p>
        <button
          type="button"
          onClick={startFromFile}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Start from a file…
        </button>
      </div>
      {unsavedDialog}
    </div>
  );
}
