"use client";

import { memo, useLayoutEffect, useRef, useState } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { MIN_NODE_SIZE } from "@/lib/diagram/layout";
import { useDiagramStore } from "@/lib/diagram/store";
import type { TextNodeData } from "@/lib/diagram/types";
import { CommentMarker } from "./CommentMarker";
import { useReadOnly } from "../viewMode";

export type TextFlowNode = Node<TextNodeData, "text">;

export const DEFAULT_FONT_SIZE = 14;

/**
 * A free text box on the canvas: double-click (or start typing once it's selected and Enter is pressed) to
 * write in it. Enter adds a line; Ctrl/⌘+Enter, Esc or clicking away finishes.
 */
function TextNodeComponent({ id, data, selected, height }: NodeProps<TextFlowNode>) {
  const updateNodeLabel = useDiagramStore((state) => state.updateNodeLabel);
  const content = useRef<HTMLDivElement>(null);
  const readOnly = useReadOnly();
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);

  const style = {
    fontSize: data.fontSize ?? DEFAULT_FONT_SIZE,
    textAlign: data.align ?? "left",
    fontWeight: data.bold ? 600 : 400,
    lineHeight: 1.35,
  } as const;
  const empty = !data.label.trim();

  /** Grows the box (never shrinks it) so every line of text shows. Layout pixels: the canvas zoom doesn't count. */
  function growToFit(element: HTMLElement | null) {
    if (!element || readOnly || !height) return;
    const needed = Math.ceil(element.scrollHeight);
    if (needed > height) useDiagramStore.getState().setNodeGeometry(id, { height: needed });
  }

  // Text changed from the panel, or a bigger font: keep it all visible.
  useLayoutEffect(() => {
    if (!editing) growToFit(content.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.label, data.fontSize, data.bold, editing]);

  return (
    <div
      className={`bb-text-node relative h-full w-full rounded-sm text-zinc-900 dark:text-zinc-100 ${
        selected ? "outline outline-1 outline-blue-600" : editing ? "" : "hover:outline hover:outline-1 hover:outline-dashed hover:outline-zinc-400"
      }`}
      onDoubleClick={() => {
        if (readOnly) return;
        cancelled.current = false;
        setEditing(true);
      }}
    >
      <NodeResizer
        minWidth={MIN_NODE_SIZE.text.width}
        minHeight={MIN_NODE_SIZE.text.height}
        isVisible={selected && !readOnly && !editing}
      />
      <CommentMarker id={id} />
      {editing ? (
        <textarea
          autoFocus
          className="nodrag nopan nowheel h-full w-full resize-none overflow-hidden bg-white/80 px-1 py-0.5 outline-none dark:bg-zinc-950/80"
          style={style}
          defaultValue={data.label}
          onFocus={(event) => event.currentTarget.select()}
          onInput={(event) => growToFit(event.currentTarget)}
          onBlur={(event) => {
            if (!cancelled.current) updateNodeLabel(id, event.target.value);
            setEditing(false);
          }}
          onKeyDown={(event) => {
            // Keep the canvas's shortcuts (Delete, arrows, B, C, T) out of the text being written.
            event.stopPropagation();
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.blur();
            if (event.key === "Escape") {
              cancelled.current = true;
              event.currentTarget.blur();
            }
          }}
        />
      ) : (
        <div
          ref={content}
          className={`h-full w-full overflow-hidden whitespace-pre-wrap break-words px-1 py-0.5 ${empty ? "italic text-zinc-400" : ""}`}
          style={style}
        >
          {empty ? (readOnly ? "" : "Double-click to write") : data.label}
        </div>
      )}
    </div>
  );
}

export default memo(TextNodeComponent);
