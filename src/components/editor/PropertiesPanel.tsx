"use client";

import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import type { BlockColorKey } from "@/lib/diagram/types";

export default function PropertiesPanel() {
  const diagram = useDiagramStore((state) => state.diagram);
  const selectedNodeId = useDiagramStore((state) => state.selectedNodeId);
  const legend = useDiagramStore((state) => state.diagram.legend);
  const updateNodeLabel = useDiagramStore((state) => state.updateNodeLabel);
  const updateNodeColor = useDiagramStore((state) => state.updateNodeColor);
  const deleteNode = useDiagramStore((state) => state.deleteNode);

  const section = getActiveSection(diagram);
  const node = section.nodes.find((candidate) => candidate.id === selectedNodeId);

  if (!node) {
    return (
      <div className="p-3 text-xs text-zinc-400">
        Select a container or component to edit its properties.
      </div>
    );
  }

  const showColor = node.type === "block" || node.type === "container";

  return (
    <div className="flex flex-col gap-3 border-b border-zinc-200 p-3 dark:border-zinc-800">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {node.type === "container" ? "Container" : "Component"}
      </h2>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Label
        <input
          className="rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          value={node.data.label}
          onChange={(event) => updateNodeLabel(node.id, event.target.value)}
        />
      </label>

      {showColor && (
        <div className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
          Color
          <div className="flex flex-wrap gap-1.5">
            {legend.map((entry) => (
              <button
                type="button"
                key={entry.key}
                title={entry.label}
                onClick={() => updateNodeColor(node.id, entry.key as BlockColorKey)}
                className="h-6 w-6 rounded-sm border-2"
                style={{
                  backgroundColor: entry.color,
                  borderColor: node.data.colorKey === entry.key ? "#2563eb" : "rgba(0,0,0,0.2)",
                }}
              />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => deleteNode(node.id)}
        className="self-start rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
      >
        Delete
      </button>
    </div>
  );
}
