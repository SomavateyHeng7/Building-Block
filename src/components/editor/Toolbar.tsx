"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useDiagramStore } from "@/lib/diagram/store";
import { createId } from "@/lib/diagram/factory";
import { downloadDiagramJson, readDiagramJsonFile, saveDiagram } from "@/lib/diagram/persistence";

export default function Toolbar() {
  const router = useRouter();
  const diagram = useDiagramStore((state) => state.diagram);
  const selectedNodeId = useDiagramStore((state) => state.selectedNodeId);
  const renameDiagram = useDiagramStore((state) => state.renameDiagram);
  const addContainer = useDiagramStore((state) => state.addContainer);
  const addBlock = useDiagramStore((state) => state.addBlock);
  const deleteNode = useDiagramStore((state) => state.deleteNode);
  const loadDiagram = useDiagramStore((state) => state.loadDiagram);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const section = diagram.sections.find((candidate) => candidate.id === diagram.activeSectionId);
  const nodeCount = section?.nodes.length ?? 0;
  const selectedNode = section?.nodes.find((node) => node.id === selectedNodeId);

  const nextPosition = () => ({
    x: 80 + (nodeCount % 5) * 48,
    y: 80 + Math.floor(nodeCount / 5) * 48,
  });

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = await readDiagramJsonFile(file);
      const withNewId = { ...imported, id: createId("diagram") };
      loadDiagram(withNewId);
      saveDiagram(withNewId);
      router.replace(`/editor/${withNewId.id}`);
    } catch {
      window.alert("That file doesn't look like a valid diagram export.");
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        href="/"
        className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← My diagrams
      </Link>
      <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
      <input
        className="rounded border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none hover:border-zinc-300 focus:border-zinc-400 dark:hover:border-zinc-700"
        value={diagram.name}
        onChange={(event) => renameDiagram(event.target.value)}
      />
      <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
      <button
        type="button"
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        onClick={() => addContainer(nextPosition())}
      >
        + Container
      </button>
      <button
        type="button"
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        onClick={() => addBlock(nextPosition(), selectedNode?.type === "container" ? selectedNode.id : null)}
      >
        + Block
      </button>
      {selectedNodeId && (
        <button
          type="button"
          className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          onClick={() => deleteNode(selectedNodeId)}
        >
          Delete selected
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          onClick={() => fileInputRef.current?.click()}
        >
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImport}
        />
        <button
          type="button"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          onClick={() => downloadDiagramJson(diagram)}
        >
          Export JSON
        </button>
      </div>
    </div>
  );
}
