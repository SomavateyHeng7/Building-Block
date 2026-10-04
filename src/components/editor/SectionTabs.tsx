"use client";

import { useState } from "react";
import { useDiagramStore } from "@/lib/diagram/store";

export default function SectionTabs() {
  const sections = useDiagramStore((state) => state.diagram.sections);
  const activeSectionId = useDiagramStore((state) => state.diagram.activeSectionId);
  const setActiveSection = useDiagramStore((state) => state.setActiveSection);
  const addSection = useDiagramStore((state) => state.addSection);
  const renameSection = useDiagramStore((state) => state.renameSection);
  const deleteSection = useDiagramStore((state) => state.deleteSection);
  const duplicateSection = useDiagramStore((state) => state.duplicateSection);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function commitRename(id: string, value: string) {
    const name = value.trim();
    if (name) renameSection(id, name);
    setEditingId(null);
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50 px-3 pt-1.5 dark:border-zinc-800 dark:bg-zinc-950">
      {sections.map((section) => {
        const active = section.id === activeSectionId;
        const confirming = pendingDeleteId === section.id;
        return (
          <div
            key={section.id}
            className={`group flex items-center gap-1 rounded-t border border-b-0 px-3 py-1.5 text-sm ${
              active
                ? "border-zinc-200 bg-white font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            {editingId === section.id ? (
              <input
                autoFocus
                defaultValue={section.name}
                className="w-28 rounded border border-zinc-400 bg-transparent px-1 text-sm outline-none"
                onBlur={(event) => commitRename(section.id, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitRename(section.id, event.currentTarget.value);
                  if (event.key === "Escape") setEditingId(null);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPendingDeleteId(null);
                  setActiveSection(section.id);
                }}
                onDoubleClick={() => setEditingId(section.id)}
                title="Double-click to rename"
              >
                {section.name}
              </button>
            )}
            {active && editingId !== section.id && (
              <>
                <button
                  type="button"
                  title="Duplicate section"
                  className="px-0.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  onClick={() => duplicateSection(section.id)}
                >
                  ⧉
                </button>
                {sections.length > 1 &&
                  (confirming ? (
                    <button
                      type="button"
                      className="rounded bg-red-600 px-1.5 text-xs text-white"
                      onClick={() => {
                        deleteSection(section.id);
                        setPendingDeleteId(null);
                      }}
                      onBlur={() => setPendingDeleteId(null)}
                      autoFocus
                    >
                      Delete?
                    </button>
                  ) : (
                    <button
                      type="button"
                      title="Delete section"
                      className="px-0.5 text-zinc-400 hover:text-red-600"
                      onClick={() => setPendingDeleteId(section.id)}
                    >
                      ×
                    </button>
                  ))}
              </>
            )}
          </div>
        );
      })}
      <button
        type="button"
        title="Add section"
        className="ml-1 rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
        onClick={() => addSection()}
      >
        +
      </button>
    </div>
  );
}
