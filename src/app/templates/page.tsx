"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { templates } from "@/templates";
import { saveDiagram } from "@/lib/diagram/persistence";

export default function TemplatesPage() {
  const router = useRouter();

  function applyTemplate(id: string) {
    const template = templates.find((candidate) => candidate.id === id);
    if (!template) return;
    const diagram = template.build();
    saveDiagram(diagram);
    router.push(`/editor/${diagram.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        ← My diagrams
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((template) => (
          <button
            type="button"
            key={template.id}
            onClick={() => applyTemplate(template.id)}
            className="rounded-lg border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
          >
            <h2 className="font-medium text-zinc-900 dark:text-zinc-100">{template.name}</h2>
            <p className="mt-1 text-sm text-zinc-500">{template.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
