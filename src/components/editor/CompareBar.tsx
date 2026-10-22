"use client";

import { CHANGE_COLORS } from "@/lib/diagram/compare";
import { useDiagramStore } from "@/lib/diagram/store";
import { useCompareView } from "./compareView";
import { Icon } from "./Icon";

/**
 * Shown while two tabs' differences are marked on the canvas: which tabs, what the colours mean, a way to
 * switch between the two, and a way to stop.
 */
export default function CompareBar() {
  const diagram = useDiagramStore((state) => state.diagram);
  const setActiveSection = useDiagramStore((state) => state.setActiveSection);
  const pair = useCompareView((state) => state.pair);
  const hide = useCompareView((state) => state.hide);

  const from = diagram.sections.find((section) => section.id === pair?.fromId);
  const to = diagram.sections.find((section) => section.id === pair?.toId);
  if (!pair || pair.diagramId !== diagram.id || !from || !to) return null;

  const onTab = (id: string) => diagram.activeSectionId === id && !diagram.activeDetailId;
  const tabButton = (section: typeof from) => (
    <button
      type="button"
      aria-pressed={onTab(section.id)}
      className="h-7 min-w-0 max-w-[10rem] truncate rounded-md px-2 font-medium hover:bg-violet-100 aria-pressed:bg-violet-200/70 dark:hover:bg-violet-900 dark:aria-pressed:bg-violet-900"
      onClick={() => setActiveSection(section.id)}
    >
      {section.name}
    </button>
  );
  const key = (color: string, label: string) => (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-violet-200 bg-violet-50 px-2 py-1.5 text-sm text-violet-950 sm:px-3 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-100">
      <span className="flex min-w-0 items-center gap-1">
        <span className="hidden shrink-0 font-semibold sm:inline">Changes:</span>
        {tabButton(from)}
        <span aria-hidden>→</span>
        {tabButton(to)}
      </span>
      <span className="flex flex-wrap items-center gap-x-3 text-xs">
        {key(CHANGE_COLORS.added, `Added (on ${to.name})`)}
        {key(CHANGE_COLORS.changed, `Changed (on ${to.name})`)}
        {key(CHANGE_COLORS.removed, `Removed (on ${from.name})`)}
      </span>
      <span className="hidden text-xs text-violet-700 xl:inline dark:text-violet-300">Exports include these marks while shown.</span>
      <button
        type="button"
        className="ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 font-medium hover:bg-violet-100 dark:hover:bg-violet-900"
        onClick={hide}
      >
        <Icon name="x" className="h-3.5 w-3.5" />
        Stop showing
      </button>
    </div>
  );
}
