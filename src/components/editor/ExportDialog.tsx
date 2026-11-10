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
  /** Whether pictures get the legend strip under the diagram. */
  legend: boolean;
}

/** What's remembered between exports, per browser. */
export type ExportPrefs = Pick<ExportChoice, "formats" | "bundle" | "theme"> & { legend?: boolean };

const FORMAT_INFO: Record<ExportFormat, { label: string; hint: string }> = {
  png: { label: "PNG image", hint: "Slides and documents" },
  svg: { label: "SVG image", hint: "Sharp at any size" },
  pdf: { label: "PDF", hint: "Printing and sharing" },
  html: { label: "Interactive viewer", hint: "HTML with pan and zoom" },
  mermaid: { label: "Mermaid", hint: "Code per tab, for docs in git" },
  plantuml: { label: "PlantUML (C4)", hint: "C4 code per tab" },
  "components-csv": { label: "Component list", hint: "CSV of every component" },
  "connections-csv": { label: "Connection list", hint: "CSV of who talks to whom" },
  document: { label: "Solution document", hint: "Markdown write-up; add PNG for pictures" },
  json: { label: "Diagram file", hint: "JSON to open again later" },
};

const MORE_FORMATS = [...CODE_FORMATS, ...DATA_FORMATS];

const SECTION_HEADING = "text-xs font-semibold uppercase tracking-wide text-zinc-500";
const TILE =
  "flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-200 p-2.5 text-sm transition-colors hover:border-zinc-400 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:has-[:checked]:border-zinc-100 dark:has-[:checked]:bg-zinc-800/60";
const CHECK = "mt-0.5 h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100";
const LINK = "text-xs font-medium text-blue-600 hover:underline dark:text-blue-400";

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

/** Two or three mutually exclusive choices as one row of buttons. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            value === option.value
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A labelled row: the name on the left, its control on the right. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-medium">{label}</span>
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
 * Choose what to export, in which formats, and how pictures look. The common picture formats are up front;
 * code, lists and files sit under "More formats". The summary at the bottom says exactly what will download.
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
  const [legend, setLegend] = useState(prefs.legend ?? true);
  // Open "More formats" straight away if one of them was used last time, so a choice is never hidden.
  const [moreOpen, setMoreOpen] = useState(() => prefs.formats.some((format) => MORE_FORMATS.includes(format)));
  const [brandingOpen, setBrandingOpen] = useState(false);
  // Start with what's on screen; an empty view falls back to everything that has something in it.
  const [viewIds, setViewIds] = useState<string[]>(() =>
    current?.nodeCount ? [current.id] : pictureable.map((view) => view.id),
  );
  const [viewsOpen, setViewsOpen] = useState(false);

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
  const moreChosen = formats.filter((format) => MORE_FORMATS.includes(format)).length;
  // Only list the views when there's a real choice to make.
  const showViewList = viewsOpen || pictureable.length > 1 || !current?.nodeCount;
  const viewSummary =
    chosenViews.length === 1 && chosenViews[0].id === currentViewId
      ? "The tab on screen"
      : chosenViews.length === pictureable.length
        ? `All ${pictureable.length} with something in them`
        : `${chosenViews.length} of ${pictureable.length}`;

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

  const formatCheckbox = (format: ExportFormat, autoFocus = false) => (
    <label key={format} className={TILE}>
      <input
        type="checkbox"
        autoFocus={autoFocus}
        checked={formats.includes(format)}
        onChange={(event) => setFormats(toggle(formats, format, event.target.checked))}
        className={CHECK}
      />
      <span className="min-w-0">
        <span className="block font-medium">{FORMAT_INFO[format].label}</span>
        <span className="block text-xs text-zinc-500">{FORMAT_INFO[format].hint}</span>
      </span>
    </label>
  );

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
          {/* 1. Format */}
          <Section title="Format">
            <div className="grid grid-cols-2 gap-2">
              {IMAGE_FORMATS.map((format, index) => formatCheckbox(format, index === 0))}
            </div>
            <button
              type="button"
              aria-expanded={moreOpen}
              className="flex items-center gap-1.5 self-start text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              onClick={() => setMoreOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="m9 6 6 6-6 6" />
              </svg>
              More formats: code, lists and files
              {moreChosen > 0 && !moreOpen && (
                <span className="rounded-full bg-zinc-900 px-1.5 text-[11px] text-white dark:bg-zinc-100 dark:text-zinc-900">{moreChosen}</span>
              )}
            </button>
            {moreOpen && <div className="grid grid-cols-2 gap-2">{MORE_FORMATS.map((format) => formatCheckbox(format))}</div>}
          </Section>

          {/* 2. What to include */}
          {needsViews && (
            <Section
              title="What to export"
              aside={
                showViewList && pictureable.length > 1 ? (
                  <span className="flex gap-3">
                    {current?.nodeCount ? (
                      <button type="button" className={LINK} onClick={() => setViewIds([current.id])}>
                        Only this tab
                      </button>
                    ) : null}
                    <button type="button" className={LINK} onClick={() => setViewIds(pictureable.map((view) => view.id))}>
                      All
                    </button>
                  </span>
                ) : null
              }
            >
              {showViewList ? (
                <>
                  <ul className="flex max-h-52 flex-col divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
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
                  <p className="text-xs text-zinc-500">{viewSummary}</p>
                </>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {viewSummary}.{" "}
                  <button type="button" className={LINK} onClick={() => setViewsOpen(true)}>
                    Change
                  </button>
                </p>
              )}
            </Section>
          )}

          {/* 3. How pictures look */}
          {pictures && (
            <Section title="Picture options">
              <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <Row label="Background">
                  <Segmented
                    label="Picture style"
                    value={theme}
                    options={[
                      { value: "light", label: "Light" },
                      { value: "dark", label: "Dark" },
                    ]}
                    onChange={setTheme}
                  />
                </Row>
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <span>
                    <span className="block text-sm font-medium">Include legend</span>
                    <span className="block text-xs text-zinc-500">The colour key under the diagram</span>
                  </span>
                  <input type="checkbox" checked={legend} onChange={(event) => setLegend(event.target.checked)} className={CHECK} />
                </label>
                <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <button
                    type="button"
                    aria-expanded={brandingOpen}
                    className="flex w-full items-center justify-between gap-2 text-left"
                    onClick={() => setBrandingOpen((open) => !open)}
                  >
                    <span>
                      <span className="block text-sm font-medium">Logo and accent colour</span>
                      <span className="block text-xs text-zinc-500">
                        {branding?.logo || branding?.color ? "Added to the title bar" : "Optional, saved with the diagram"}
                      </span>
                    </span>
                    <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${brandingOpen ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </button>
                  {brandingOpen && (
                    <div className="mt-3 flex flex-col gap-3">
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
                          <button type="button" className={LINK} onClick={() => setBranding({ ...branding, logo: undefined })}>
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
                          <button type="button" className={LINK} onClick={() => setBranding({ ...branding, color: undefined })}>
                            Remove colour
                          </button>
                        )}
                      </div>
                      {logoError && (
                        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                          {logoError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* 4. Packaging, only when it changes what arrives */}
          {bundleMatters && (
            <Section title="Download as">
              <Segmented
                label="Download as"
                value={bundle}
                options={[
                  { value: "one", label: asOne.zipName ? "One zip" : "One file" },
                  { value: "separate", label: `${asSeparate.files.length} separate files` },
                ]}
                onChange={setBundle}
              />
              {bundle === "separate" && <p className="text-xs text-zinc-500">Your browser may ask you to allow several downloads.</p>}
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
              onClick={() => onExport({ formats, views: chosenViews, bundle, theme, legend })}
            >
              {problem ? "Download" : downloadLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
