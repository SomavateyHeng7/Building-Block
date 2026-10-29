"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CODE_FORMATS,
  DATA_FORMATS,
  IMAGE_FORMATS,
  describeFiles,
  exportViews,
  planExport,
  type Bundle,
  type ExportFormat,
  type ExportPlan,
  type ExportView,
} from "@/lib/diagram/exportPlan";
import type { Diagram } from "@/lib/diagram/types";
import { logoFromFile } from "@/lib/diagram/branding";
import { useDiagramStore } from "@/lib/diagram/store";
import { useDialogFocus } from "./useDialogFocus";

export type ExportTheme = "light" | "dark";

export interface ExportChoice {
  formats: ExportFormat[];
  views: ExportView[];
  bundle: Bundle;
  theme: ExportTheme;
}

/** What's remembered between exports, per browser. */
export type ExportPrefs = Pick<ExportChoice, "formats" | "bundle" | "theme">;

const FORMAT_INFO: Record<ExportFormat, { label: string; hint: string }> = {
  png: { label: "PNG image", hint: "For slides and documents" },
  svg: { label: "SVG image", hint: "Stays sharp at any size" },
  pdf: { label: "PDF", hint: "For printing and sharing" },
  html: { label: "Interactive viewer", hint: "One HTML file with pan and zoom; opens offline" },
  mermaid: { label: "Mermaid", hint: "A flowchart per tab (sequence tabs as sequence code), for docs in git" },
  plantuml: { label: "PlantUML (C4)", hint: "C4 container diagram per tab, for docs in git" },
  "components-csv": { label: "Component list", hint: "CSV: every container and component, with details" },
  "connections-csv": { label: "Connection list", hint: "CSV: who talks to whom, how, and what flows" },
  document: { label: "Solution document", hint: "Markdown: components, connections, open comments. Pick PNG too to include the pictures" },
  json: { label: "Diagram file", hint: "JSON you can open again with File → Open" },
};

const SECTION_HEADING = "text-xs font-semibold uppercase tracking-wide text-zinc-500";
const OPTION =
  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 dark:has-[:checked]:border-zinc-100 dark:has-[:checked]:bg-zinc-800/60";
const OPTION_IDLE = "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500";

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={id} className={SECTION_HEADING}>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </div>
  );
}

function toggle<T>(list: T[], item: T, on: boolean): T[] {
  return on ? (list.includes(item) ? list : [...list, item]) : list.filter((value) => value !== item);
}

/** The file names an export will produce, shortened after a few. */
function fileList(plan: ExportPlan): string {
  if (plan.zipName) return plan.zipName;
  const names = plan.files.map((file) => file.name);
  return names.length > 4 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", ");
}

/**
 * Choose what to export (which tabs and internal designs), in which formats, and whether it comes as one
 * file or several. The summary at the bottom says exactly what will download.
 */
export default function ExportDialog({
  diagram,
  currentViewId,
  prefs,
  onCancel,
  onExport,
}: {
  diagram: Diagram;
  currentViewId: string;
  prefs: ExportPrefs;
  onCancel: () => void;
  onExport: (choice: ExportChoice) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog);
  const setBranding = useDiagramStore((state) => state.setBranding);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const branding = diagram.branding;
  const views = useMemo(() => exportViews(diagram), [diagram]);

  async function chooseLogo(file: File) {
    setLogoError(null);
    try {
      setBranding({ ...branding, logo: await logoFromFile(file) });
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : "That picture couldn't be used.");
    }
  }
  const pictureable = views.filter((view) => view.nodeCount > 0);
  const current = views.find((view) => view.id === currentViewId);
  const [formats, setFormats] = useState<ExportFormat[]>(prefs.formats);
  const [bundle, setBundle] = useState<Bundle>(prefs.bundle);
  const [theme, setTheme] = useState<ExportTheme>(prefs.theme);
  // Start with what's on screen; an empty view falls back to everything that has something in it.
  const [viewIds, setViewIds] = useState<string[]>(() =>
    current?.nodeCount ? [current.id] : pictureable.map((view) => view.id),
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const chosenViews = views.filter((view) => viewIds.includes(view.id));
  const pictures = formats.some((format) => IMAGE_FORMATS.includes(format));
  const needsViews = pictures || formats.some((format) => CODE_FORMATS.includes(format));
  const asOne = planExport(diagram, { views: chosenViews, formats, bundle: "one" });
  const asSeparate = planExport(diagram, { views: chosenViews, formats, bundle: "separate" });
  const plan = bundle === "one" ? asOne : asSeparate;
  // Only ask how to download when the answer changes what arrives.
  const bundleMatters = asOne.files.length !== asSeparate.files.length || !!asOne.zipName;

  const problem = !formats.length
    ? "Choose at least one format."
    : needsViews && !chosenViews.length
      ? "Choose at least one tab or internal design."
      : !plan.files.length
        ? "There's nothing to export yet. Add a container or component first."
        : null;

  const fileCount = plan.zipName ? 1 : plan.files.length;
  const downloadLabel = plan.zipName
    ? `Download ${plan.zipName}`
    : fileCount === 1
      ? `Download ${plan.files[0].name}`
      : `Download ${fileCount} files`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onCancel}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 id="export-title" className="text-base font-semibold">
            Export &ldquo;{diagram.name}&rdquo;
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={onCancel}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
          <Section title="Formats">
            <p className="-mt-1 text-xs text-zinc-500">Pick as many as you like.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {IMAGE_FORMATS.map((format) => (
                <label key={format} className={`${OPTION} ${OPTION_IDLE} sm:flex-col sm:gap-1.5`}>
                  <input
                    type="checkbox"
                    autoFocus={format === IMAGE_FORMATS[0]}
                    checked={formats.includes(format)}
                    onChange={(event) => setFormats(toggle(formats, format, event.target.checked))}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span>
                    <span className="block font-medium">{FORMAT_INFO[format].label}</span>
                    <span className="text-xs text-zinc-500">{FORMAT_INFO[format].hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">Diagram as code (one file per tab you choose)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CODE_FORMATS.map((format) => (
                <label key={format} className={`${OPTION} ${OPTION_IDLE}`}>
                  <input
                    type="checkbox"
                    checked={formats.includes(format)}
                    onChange={(event) => setFormats(toggle(formats, format, event.target.checked))}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span>
                    <span className="block font-medium">{FORMAT_INFO[format].label}</span>
                    <span className="text-xs text-zinc-500">{FORMAT_INFO[format].hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">Lists and files (always the whole diagram)</p>
            <div className="flex flex-col gap-2">
              {DATA_FORMATS.map((format) => (
                <label key={format} className={`${OPTION} ${OPTION_IDLE}`}>
                  <input
                    type="checkbox"
                    checked={formats.includes(format)}
                    onChange={(event) => setFormats(toggle(formats, format, event.target.checked))}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span>
                    <span className="block font-medium">{FORMAT_INFO[format].label}</span>
                    <span className="text-xs text-zinc-500">{FORMAT_INFO[format].hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </Section>

          {needsViews && (
            <Section
              title="Which tabs and internal designs"
              aside={
                <span className="flex gap-3 text-xs font-medium">
                  {current?.nodeCount ? (
                    <button type="button" className="text-blue-600 hover:underline dark:text-blue-400" onClick={() => setViewIds([current.id])}>
                      Only this view
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                    onClick={() => setViewIds(pictureable.map((view) => view.id))}
                  >
                    Everything
                  </button>
                </span>
              }
            >
              <ul className="flex flex-col divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
                {views.map((view) => (
                  <li key={view.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 ${view.componentId ? "pl-9" : ""}`}
                    >
                      <input
                        type="checkbox"
                        disabled={!view.nodeCount}
                        checked={viewIds.includes(view.id)}
                        onChange={(event) => setViewIds(toggle(viewIds, view.id, event.target.checked))}
                        className="h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {view.label}
                        {view.componentId && <span className="ml-1.5 text-xs text-zinc-500">internal design</span>}
                      </span>
                      {view.id === currentViewId && (
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          On screen
                        </span>
                      )}
                      {!view.nodeCount && <span className="shrink-0 text-xs text-zinc-400">Empty</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {pictures && (
            <Section title="Picture style">
              <div role="radiogroup" aria-label="Picture style" className="grid grid-cols-2 gap-2">
                {(["light", "dark"] as const).map((value) => (
                  <label key={value} className={`${OPTION} ${OPTION_IDLE} items-center`}>
                    <input
                      type="radio"
                      name="export-theme"
                      checked={theme === value}
                      onChange={() => setTheme(value)}
                      className="h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
                    />
                    <span className="font-medium capitalize">{value}</span>
                    <span
                      aria-hidden
                      className={`ml-auto h-5 w-8 rounded border ${value === "light" ? "border-zinc-300 bg-white" : "border-zinc-600 bg-zinc-900"}`}
                    />
                  </label>
                ))}
              </div>
            </Section>
          )}

          {pictures && (
            <Section title="Branding">
              <p className="-mt-1 text-xs text-zinc-500">
                Added to the title bar of pictures, PDF pages and the viewer. Kept in the diagram file, so it&apos;s there next time.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Choose a logo picture"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void chooseLogo(file);
                  }}
                />
                {branding?.logo && (
                  // A data address, so there is nothing for the framework's image loader to optimise.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.logo} alt="Your logo" className="h-8 w-auto rounded border border-zinc-200 bg-white p-0.5 dark:border-zinc-700" />
                )}
                <button
                  type="button"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  onClick={() => logoInput.current?.click()}
                >
                  {branding?.logo ? "Change logo…" : "Add a logo…"}
                </button>
                {branding?.logo && (
                  <button type="button" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400" onClick={() => setBranding({ ...branding, logo: undefined })}>
                    Remove logo
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  Accent colour
                  <input
                    type="color"
                    value={branding?.color ?? "#1f2937"}
                    onChange={(event) => setBranding({ ...branding, color: event.target.value })}
                    className="h-8 w-10 cursor-pointer rounded border border-zinc-300 bg-transparent p-0.5 dark:border-zinc-700"
                  />
                </label>
                {branding?.color && (
                  <button type="button" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400" onClick={() => setBranding({ ...branding, color: undefined })}>
                    Remove colour
                  </button>
                )}
              </div>
              {logoError && (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {logoError}
                </p>
              )}
            </Section>
          )}

          {bundleMatters && (
            <Section title="Download as">
              <div className="flex flex-col gap-2">
                <label className={`${OPTION} ${OPTION_IDLE}`}>
                  <input
                    type="radio"
                    name="export-bundle"
                    checked={bundle === "one"}
                    onChange={() => setBundle("one")}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span>
                    <span className="block font-medium">One file</span>
                    <span className="text-xs text-zinc-500">
                      {asOne.zipName
                        ? `${asOne.zipName}, a zip with ${describeFiles(asOne.files)}`
                        : `${asOne.files[0]?.name}, with a page for each view`}
                    </span>
                  </span>
                </label>
                <label className={`${OPTION} ${OPTION_IDLE}`}>
                  <input
                    type="radio"
                    name="export-bundle"
                    checked={bundle === "separate"}
                    onChange={() => setBundle("separate")}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span>
                    <span className="block font-medium">Separate files</span>
                    <span className="text-xs text-zinc-500">
                      {asSeparate.files.length} downloads. Your browser may ask you to allow downloading several files.
                    </span>
                  </span>
                </label>
              </div>
            </Section>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-200 bg-zinc-50 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-950/40">
          <p className="text-xs text-zinc-600 dark:text-zinc-400" aria-live="polite">
            {problem ?? (
              <>
                You&apos;ll get <span className="font-medium text-zinc-900 dark:text-zinc-100">{fileList(plan)}</span>
                {plan.zipName ? ` (${describeFiles(plan.files)})` : ""}.
              </>
            )}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!!problem}
              className="max-w-full truncate rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              onClick={() => onExport({ formats, views: chosenViews, bundle, theme })}
            >
              {problem ? "Download" : downloadLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
