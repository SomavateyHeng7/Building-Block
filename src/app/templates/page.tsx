"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { templates } from "@/templates";
import { startDiagram } from "@/lib/diagram/file";
import { ThemeToggle } from "@/components/theme-toggle";

const CARD =
  "flex h-full flex-col items-start justify-start rounded-lg border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus-visible:outline-zinc-100";

export default function TemplatesPage() {
  const router = useRouter();

  function applyTemplate(id: string) {
    const template = templates.find((candidate) => candidate.id === id);
    if (!template) return;
    startDiagram(template.build());
    router.push("/editor");
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
            <h2 className="font-medium text-zinc-900 dark:text-zinc-100">{template.name}</h2>
            <p className="mt-1 text-sm text-zinc-500">{template.description}</p>
          </button>
        ))}
      </div>

      <p className="text-sm text-zinc-500">
        To reuse your own layout and legend, save a diagram as a file, then use <strong>Open file</strong> on the start page next time.
      </p>
    </div>
  );
}
