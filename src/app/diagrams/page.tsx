"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  getDiagramIndexServerSnapshot,
  getDiagramIndexSnapshot,
  subscribeDiagramIndex,
} from "@/lib/diagram/persistence";
import { ThemeToggle } from "@/components/theme-toggle";
import { ImportDiagramButton } from "@/components/ImportDiagramButton";

export default function DiagramsPage() {
  const diagrams = useSyncExternalStore(
    subscribeDiagramIndex,
    getDiagramIndexSnapshot,
    getDiagramIndexServerSnapshot,
  );

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <div className="absolute right-6 top-6">
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
          <Link
            href="/editor/new"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Start blank
          </Link>
          <Link
            href="/templates"
            className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Browse templates
          </Link>
          <ImportDiagramButton
            label="Import file"
            className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          />
        </div>
      </div>

      {diagrams.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            My diagrams
          </h2>
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {diagrams.map((diagram) => (
              <li key={diagram.id}>
                <Link
                  href={`/editor/${diagram.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {diagram.name}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {new Date(diagram.updatedAt).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
