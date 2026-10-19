"use client";

import { Icon } from "./Icon";

/** Collapses or expands a side panel on wide screens; below lg the panels are drawers instead. */
export default function PanelToggle({
  side,
  expanded,
  label,
  onClick,
}: {
  side: "left" | "right";
  expanded: boolean;
  /** What the panel is, e.g. "the components panel". */
  label: string;
  onClick: () => void;
}) {
  const action = `${expanded ? "Hide" : "Show"} ${label}`;
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={action}
      title={action}
      className="-my-1.5 hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 lg:inline-flex dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      onClick={onClick}
    >
      <Icon name={side === "left" ? "panelLeft" : "panel"} />
    </button>
  );
}
