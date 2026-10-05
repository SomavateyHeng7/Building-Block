"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { templates } from "@/templates";
import {
  deleteUserTemplate,
  diagramFromUserTemplate,
  getUserTemplatesServerSnapshot,
  getUserTemplatesSnapshot,
  subscribeUserTemplates,
  type UserTemplate,
} from "@/templates/userTemplates";
import { saveDiagram } from "@/lib/diagram/persistence";
import type { Diagram } from "@/lib/diagram/types";
import { ThemeToggle } from "@/components/theme-toggle";

const CARD =
  "rounded-lg border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600";

export default function TemplatesPage() {
  const router = useRouter();
  const userTemplates = useSyncExternalStore(
    subscribeUserTemplates,
    getUserTemplatesSnapshot,
    getUserTemplatesServerSnapshot,
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function open(diagram: Diagram) {
    saveDiagram(diagram);
    router.push(`/editor/${diagram.id}`);
  }

  function applyTemplate(id: string) {
    const template = templates.find((candidate) => candidate.id === id);
    if (template) open(template.build());
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <Link href="/diagrams" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← My diagrams
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

      <h2 className="mt-4 text-lg font-semibold tracking-tight">My templates</h2>
      {userTemplates.length === 0 ? (
        <p className="text-sm text-zinc-500">
          None yet. In the editor, use <span className="font-medium">Save as template</span> to reuse a
          diagram&apos;s layout and legend as a starting point.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {userTemplates.map((template: UserTemplate) => (
            <div key={template.id} className={`${CARD} group relative`}>
              <button
                type="button"
                className="absolute inset-0 rounded-lg"
                aria-label={`Use template ${template.name}`}
                onClick={() => open(diagramFromUserTemplate(template))}
              />
              <h3 className="pr-16 font-medium text-zinc-900 dark:text-zinc-100">{template.name}</h3>
              <p className="mt-1 text-sm text-zinc-500">{template.description}</p>
              <p className="mt-2 text-xs text-zinc-400">
                Saved {new Date(template.createdAt).toLocaleDateString()}
              </p>
              {pendingDeleteId === template.id ? (
                <button
                  type="button"
                  autoFocus
                  className="absolute right-3 top-3 rounded bg-red-600 px-2 py-0.5 text-xs text-white"
                  onClick={() => {
                    deleteUserTemplate(template.id);
                    setPendingDeleteId(null);
                  }}
                  onBlur={() => setPendingDeleteId(null)}
                >
                  Delete?
                </button>
              ) : (
                <button
                  type="button"
                  title="Delete template"
                  className="absolute right-3 top-3 rounded px-1.5 text-zinc-400 opacity-0 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                  onClick={() => setPendingDeleteId(template.id)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
