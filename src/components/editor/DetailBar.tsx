"use client";

import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { Icon } from "./Icon";

/** Shown while a component's internal design (L2) is open: where you are, and the way back up. */
export default function DetailBar() {
  const parent = useDiagramStore((state) => getActiveSection(state.diagram).parent);
  const closeDetail = useDiagramStore((state) => state.closeDetail);
  if (!parent) return null;

  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-blue-200 bg-blue-50 px-2 py-1.5 text-sm text-blue-950 sm:px-3 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
      <button
        type="button"
        title="Back to the tab (Esc)"
        className="inline-flex h-7 min-w-0 max-w-[45%] shrink-0 items-center gap-1 rounded-md px-2 font-medium hover:bg-blue-100 dark:hover:bg-blue-900"
        onClick={closeDetail}
      >
        <Icon name="arrowLeft" />
        <span className="truncate">
          <span className="hidden sm:inline">Back to</span> {parent.section.name}
        </span>
      </button>
      <span aria-hidden className="text-blue-300 dark:text-blue-700">
        /
      </span>
      <span className="min-w-0 truncate font-semibold">{parent.component.data.label}</span>
      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
        L2 · Internal design
      </span>
    </div>
  );
}
