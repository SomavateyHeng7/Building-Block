"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  TEMPLATE_CATEGORIES,
  describeTemplate,
  filterTemplates,
  templates,
  templatesSearch,
  type Orientation,
  type TemplateCategory,
} from "@/templates";
import { openDiagramFromDevice } from "@/lib/diagram/persistence/file";
import { pruneRecentTemplates, useRecentTemplates } from "@/lib/editor/recentTemplates";
import { startFromTemplate } from "@/lib/editor/startTemplate";
import { ThemeToggle } from "@/components/app/theme-toggle";
import BackLink from "@/components/app/BackLink";
import TemplatePreview from "@/components/templates/TemplatePreview";
import { useUnsavedGuard } from "@/components/editor/shared/useUnsavedGuard";

const CARD =
  "flex h-full flex-col rounded-lg border border-zinc-200 transition-colors hover:border-zinc-400 focus-within:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus-within:border-zinc-600";
const CARD_BUTTON =
  "flex w-full flex-1 flex-col items-start justify-start rounded-lg p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100";
const CHIP =
  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100";
const CHIP_OFF =
  "border-zinc-300 text-zinc-700 hover:border-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800";
const CHIP_ON = "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";

const ORIENTATIONS: { value: Orientation; label: string }[] = [
  { value: "vertical", label: "Vertical lanes" },
  { value: "horizontal", label: "Horizontal lanes" },
];

/** `?category=Process` opens the page filtered (the start page links to it); anything else shows all. `?q=` is the search. */
function categoryFromQuery(value: string | null): TemplateCategory | "All" {
  return TEMPLATE_CATEGORIES.find((name) => name === value) ?? "All";
}

export default function TemplatesPage() {
  // useSearchParams needs a Suspense boundary on a prerendered route.
  return (
    <Suspense fallback={null}>
      <Templates />
    </Suspense>
  );
}

function Templates() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // A diagram can still be open in memory, e.g. after the browser's Back button from the editor.
  const { guard, dialog: unsavedDialog } = useUnsavedGuard();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState<TemplateCategory | "All">(() => categoryFromQuery(searchParams.get("category")));
  // Mirror the filters in the address. replaceState doesn't reload or fetch the page, and typing doesn't fill the
  // history with one entry per letter.
  useEffect(() => {
    const next = templatesSearch(query, category);
    if (next !== window.location.search) window.history.replaceState(window.history.state, "", `${window.location.pathname}${next}`);
  }, [query, category]);
  const [orientations, setOrientations] = useState<Record<string, Orientation>>({});
  const recentIds = useRecentTemplates();
  useEffect(() => pruneRecentTemplates(templates.map((template) => template.id)), []);

  const orientationOf = (id: string): Orientation => orientations[id] ?? "vertical";
  const shown = filterTemplates(templates, query, category);
  const filtering = query.trim() !== "" || category !== "All";
  const recent = recentIds.flatMap((id) => templates.filter((template) => template.id === id));

  function applyTemplate(id: string) {
    const template = templates.find((candidate) => candidate.id === id);
    if (!template) return;
    guard(() => {
      startFromTemplate(template, { orientation: orientationOf(id) });
      router.push("/editor");
    });
  }

  function clearFilters() {
    setQuery("");
    setCategory("All");
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex items-center justify-between">
        <BackLink href="/diagrams">Start</BackLink>
        <ThemeToggle />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>

      <div className="flex flex-col gap-3">
        <input
          type="search"
          aria-label="Search templates"
          placeholder="Search templates, e.g. swimlane, cloud, roadmap"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-base outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
          {(["All", ...TEMPLATE_CATEGORIES] as const).map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
              className={`${CHIP} ${category === name ? CHIP_ON : CHIP_OFF}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {recent.length > 0 && !filtering && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">Recently used:</span>
          {recent.map((template) => (
            <button key={template.id} type="button" onClick={() => applyTemplate(template.id)} className={`${CHIP} ${CHIP_OFF}`}>
              {template.name}
            </button>
          ))}
        </div>
      )}

      <p aria-live="polite" className="text-sm text-zinc-500">
        {filtering ? `${shown.length} of ${templates.length} templates` : `${templates.length} templates`}
      </p>

      {shown.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-zinc-300 p-6 dark:border-zinc-700">
          <p className="text-zinc-700 dark:text-zinc-300">No template matches that search.</p>
          <button type="button" onClick={clearFilters} className={`${CHIP} ${CHIP_OFF}`}>
            Clear search and filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((template) => {
            const orientation = orientationOf(template.id);
            return (
              <div key={template.id} className={CARD}>
                <button type="button" onClick={() => applyTemplate(template.id)} className={CARD_BUTTON}>
                  <div className="mb-3 w-full">
                    <TemplatePreview
                      key={orientation}
                      build={() => template.build({ orientation })}
                      name={template.name}
                    />
                  </div>
                  <span className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{template.category}</span>
                  <h2 className="font-medium text-zinc-900 dark:text-zinc-100">{template.name}</h2>
                  <p className="mt-1 text-sm text-zinc-500">{template.description}</p>
                  {describeTemplate(template) && (
                    <p className="mt-2 text-xs font-medium text-zinc-500">{describeTemplate(template)}</p>
                  )}
                </button>
                {template.orientable && (
                  <div role="group" aria-label={`${template.name} lane direction`} className="flex flex-wrap gap-2 px-4 pb-4">
                    {ORIENTATIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={orientation === value}
                        onClick={() => setOrientations((current) => ({ ...current, [template.id]: value }))}
                        className={`${CHIP} ${orientation === value ? CHIP_ON : CHIP_OFF}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
