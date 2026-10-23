"use client";

import type { ReactNode } from "react";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { connectionCaption } from "@/lib/diagram/flowAdapter";
import { legendUsedIn } from "@/lib/diagram/export";
import { Icon } from "./Icon";
import { NoteLines } from "./nodes/BlockNode";

const DIRECTIONS = { forward: "One way", both: "Both ways", none: "No arrow" };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-zinc-800 dark:text-zinc-200">{children}</dd>
    </div>
  );
}

/**
 * View mode's read-only details, as a sheet along the bottom: whatever was tapped (a component,
 * container or connection), or the legend for this view.
 */
export default function ViewSheet({ legendOpen, onCloseLegend }: { legendOpen: boolean; onCloseLegend: () => void }) {
  const diagram = useDiagramStore((state) => state.diagram);
  const selectedNodeIds = useDiagramStore((state) => state.selectedNodeIds);
  const selectedEdgeId = useDiagramStore((state) => state.selectedEdgeId);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const setSelectedEdge = useDiagramStore((state) => state.setSelectedEdge);
  const openDetail = useDiagramStore((state) => state.openDetail);

  const section = getActiveSection(diagram);
  const labelOf = (id: string) => section.nodes.find((node) => node.id === id)?.data.label ?? "?";
  const edge = selectedEdgeId ? section.edges?.find((candidate) => candidate.id === selectedEdgeId) : undefined;
  const node = selectedNodeIds.length === 1 ? section.nodes.find((candidate) => candidate.id === selectedNodeIds[0]) : undefined;

  let title: string;
  let body: ReactNode;
  if (edge) {
    title = `${labelOf(edge.source)} → ${labelOf(edge.target)}`;
    body = (
      <dl className="flex flex-col gap-3">
        {edge.label && <Field label="What flows">{edge.label}</Field>}
        {edge.protocol && <Field label="Protocol or technology">{edge.protocol}</Field>}
        {edge.description && <Field label="Description">{edge.description}</Field>}
        <Field label="Arrows">
          {DIRECTIONS[edge.direction ?? "forward"]}, {edge.style === "dashed" ? "dashed" : "solid"} line
        </Field>
      </dl>
    );
  } else if (node) {
    const category = diagram.legend.find((entry) => entry.key === node.data.colorKey);
    const container = node.parentId ? section.nodes.find((candidate) => candidate.id === node.parentId) : undefined;
    const links = (section.edges ?? []).filter((candidate) => candidate.source === node.id || candidate.target === node.id);
    const insideCount = node.data.kind === "block" ? (node.data.detail?.nodes.length ?? 0) : 0;
    title = node.data.label;
    body = (
      <dl className="flex flex-col gap-3">
        <Field label={node.type === "container" ? "Container" : "Component"}>
          <span className="inline-flex items-center gap-1.5">
            {category && (
              <span aria-hidden className="h-3 w-3 rounded-sm border border-black/15" style={{ backgroundColor: category.color }} />
            )}
            {category?.label ?? "No category"}
            {container && <span className="text-zinc-500"> · in {container.data.label}</span>}
          </span>
        </Field>
        {node.data.technology && <Field label="Technology">{node.data.technology}</Field>}
        {node.data.owner && <Field label="Owner">{node.data.owner}</Field>}
        {node.data.description && <Field label="Description">{node.data.description}</Field>}
        {node.data.notes && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
            <Field label="Notes">
              <NoteLines notes={node.data.notes} />
            </Field>
          </div>
        )}
        {links.length > 0 && (
          <Field label="Connections">
            <ul className="flex flex-col gap-1">
              {links.map((link) => {
                const outgoing = link.source === node.id;
                const caption = connectionCaption(link);
                return (
                  <li key={link.id} className="flex items-baseline gap-1.5">
                    <span aria-hidden>{link.direction === "both" ? "↔" : link.direction === "none" ? "—" : outgoing ? "→" : "←"}</span>
                    <span className="font-medium">{labelOf(outgoing ? link.target : link.source)}</span>
                    {caption && <span className="text-zinc-500">{caption}</span>}
                  </li>
                );
              })}
            </ul>
          </Field>
        )}
        {insideCount > 0 && !section.parent && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
            onClick={() => openDetail(node.id)}
          >
            <Icon name="layers" className="h-4 w-4" />
            Open internal design ({insideCount})
          </button>
        )}
      </dl>
    );
  } else if (selectedNodeIds.length > 1) {
    title = `${selectedNodeIds.length} items selected`;
    body = <p className="text-sm text-zinc-500">Tap one item to see its details.</p>;
  } else if (legendOpen) {
    const used = legendUsedIn(diagram, section);
    title = "Legend";
    body = used.length ? (
      <ul className="flex flex-col gap-2">
        {used.map((entry) => (
          <li key={entry.key} className="flex items-center gap-2.5 text-sm">
            <span aria-hidden className="h-4 w-6 shrink-0 rounded border border-black/15" style={{ backgroundColor: entry.color }} />
            {entry.label}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-zinc-500">No categories are used in this view.</p>
    );
  } else {
    return null;
  }

  function close() {
    setSelection([]);
    setSelectedEdge(null);
    onCloseLegend();
  }

  return (
    <section
      aria-label="Details"
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-[55%] flex-col rounded-t-2xl border-t border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-start gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="min-w-0 flex-1 break-words pt-1.5 font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        <button
          type="button"
          aria-label="Close details"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={close}
        >
          <Icon name="x" />
        </button>
      </div>
      <div className="overflow-y-auto px-4 py-3">{body}</div>
    </section>
  );
}
