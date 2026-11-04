"use client";

import { useState } from "react";
import { layoutSequence } from "@/lib/diagram/sequence";
import { readableTextOn } from "@/lib/diagram/palette";
import { shapeInfo } from "@/lib/diagram/shapes";
import type { ConnectionSide, Diagram, DiagramNode, SequenceDiagram } from "@/lib/diagram/types";

const PADDING = 24;

/** A font size (up to `max`) at which `text` fits in `width`; about 0.56 em per character. */
function fitFont(text: string, width: number, max: number) {
  return Math.min(max, width / (Math.max(1, text.length) * 0.56));
}

/** The middle of a box's side, and which way a line leaves it. */
function anchor(box: { x: number; y: number }, node: DiagramNode, side: ConnectionSide) {
  const { width, height } = node.size;
  if (side === "top") return { x: box.x + width / 2, y: box.y, dx: 0, dy: -1 };
  if (side === "bottom") return { x: box.x + width / 2, y: box.y + height, dx: 0, dy: 1 };
  if (side === "left") return { x: box.x, y: box.y + height / 2, dx: -1, dy: 0 };
  return { x: box.x + width, y: box.y + height / 2, dx: 1, dy: 0 };
}

/** A static, scaled-down picture (in one 16:10 frame, so cards line up) of a template's first section, drawn from the same data the editor loads. */
export default function TemplatePreview({ build, name }: { build: () => Diagram; name: string }) {
  // build() mints fresh ids, so run it once per card rather than on every render.
  const [diagram] = useState(build);
  const section = diagram.sections[0];
  if (section?.sequence) return <SequencePreview diagram={diagram} sequence={section.sequence} name={name} />;

  const layout = (() => {
    const nodes = section?.nodes ?? [];
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const absolute = (node: DiagramNode) => {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      return { x: node.position.x + (parent?.position.x ?? 0), y: node.position.y + (parent?.position.y ?? 0) };
    };
    const boxes = nodes.map((node) => ({ node, ...absolute(node) }));
    const maxX = Math.max(0, ...boxes.map((box) => box.x + box.node.size.width));
    const maxY = Math.max(0, ...boxes.map((box) => box.y + box.node.size.height));
    return { boxes, byId, absolute, width: maxX + PADDING * 2, height: maxY + PADDING * 2 };
  })();

  if (!section || layout.boxes.length === 0) {
    return (
      <div
        role="img"
        aria-label={`${name} preview: an empty canvas`}
        className="flex aspect-[16/10] w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-[radial-gradient(circle,_rgb(161_161_170/0.35)_1px,_transparent_1px)] bg-[length:12px_12px] text-xs text-zinc-400 dark:border-zinc-700"
      >
        Empty canvas
      </div>
    );
  }

  const colorOf = (key?: string) => diagram.legend.find((entry) => entry.key === key)?.color ?? "#ffffff";
  const containers = layout.boxes.filter((box) => box.node.type === "container");
  const blocks = layout.boxes.filter((box) => box.node.type === "block");
  const texts = layout.boxes.filter((box) => box.node.type === "text");

  return (
    <svg
      role="img"
      aria-label={`${name} preview`}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="aspect-[16/10] w-full rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <g transform={`translate(${PADDING} ${PADDING})`}>
        {containers.map(({ node, x, y }) => (
          <g key={node.id}>
            <rect
              x={x}
              y={y}
              width={node.size.width}
              height={node.size.height}
              rx={8}
              className="fill-white stroke-zinc-300 dark:fill-zinc-950 dark:stroke-zinc-700"
              strokeWidth={2}
            />
            <text x={x + 16} y={y + 30} fontSize={20} fontWeight={600} className="fill-zinc-600 dark:fill-zinc-300">
              {node.data.label}
            </text>
          </g>
        ))}

        {(section.edges ?? []).map((edge) => {
          const source = layout.byId.get(edge.source);
          const target = layout.byId.get(edge.target);
          if (!source || !target) return null;
          const from = anchor(layout.absolute(source), source, edge.sourceSide ?? "right");
          const to = anchor(layout.absolute(target), target, edge.targetSide ?? "left");
          const bend = Math.max(40, Math.abs(from.dx ? to.x - from.x : to.y - from.y) / 2);
          return (
            <path
              key={edge.id}
              d={`M${from.x} ${from.y} C${from.x + from.dx * bend} ${from.y + from.dy * bend} ${to.x + to.dx * bend} ${to.y + to.dy * bend} ${to.x} ${to.y}`}
              fill="none"
              strokeWidth={3}
              strokeDasharray={edge.style === "dashed" ? "10 8" : undefined}
              className="stroke-zinc-500"
            />
          );
        })}

        {blocks.map(({ node, x, y }) => {
          const color = colorOf(node.data.kind === "block" ? node.data.colorKey : undefined);
          const shape = node.data.kind === "block" ? node.data.shape : undefined;
          const { width, height } = node.size;
          return (
            <g key={node.id}>
              {shapeInfo(shape).path ? (
                <path
                  d={shapeInfo(shape).path}
                  transform={`translate(${x} ${y}) scale(${width / 100} ${height / 100})`}
                  vectorEffect="non-scaling-stroke"
                  fill={color}
                  stroke="rgba(0,0,0,0.25)"
                  strokeWidth={1.5}
                />
              ) : (
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={shape === "terminal" ? height / 2 : 6}
                  fill={color}
                  stroke="rgba(0,0,0,0.25)"
                  strokeWidth={1.5}
                />
              )}
              <text
                x={x + node.size.width / 2}
                y={y + node.size.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fitFont(node.data.label, width * (1 - (2 * shapeInfo(shape).inset) / 100) - 16, 17)}
                fontWeight={500}
                fill={readableTextOn(color)}
              >
                {node.data.label}
              </text>
            </g>
          );
        })}
        {texts.map(({ node, x, y }) => (
          <text
            key={node.id}
            x={x}
            y={y + node.size.height / 2}
            dominantBaseline="central"
            fontSize={fitFont(node.data.label.split("\n")[0], node.size.width, node.data.kind === "text" ? (node.data.fontSize ?? 14) * 1.2 : 17)}
            fontWeight={node.data.kind === "text" && node.data.bold ? 600 : 400}
            className="fill-zinc-700 dark:fill-zinc-300"
          >
            {node.data.label.split("\n")[0]}
          </text>
        ))}
      </g>
    </svg>
  );
}

/** A sequence template: the participants' boxes, their lifelines and the messages between them, without text. */
function SequencePreview({ diagram, sequence, name }: { diagram: Diagram; sequence: SequenceDiagram; name: string }) {
  const layout = layoutSequence(sequence);
  const colorOf = (key?: string) => diagram.legend.find((entry) => entry.key === key)?.color ?? "#ffffff";
  const xOf = (id: string) => layout.columns.find((column) => column.participant.id === id)?.x ?? 0;
  return (
    <svg
      role="img"
      aria-label={`${name} preview`}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="aspect-[16/10] w-full rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {layout.columns.map((column) => (
        <g key={column.participant.id}>
          <line x1={column.x} x2={column.x} y1={layout.lifelineTop} y2={layout.lifelineBottom} strokeWidth={2} strokeDasharray="6 6" className="stroke-zinc-300 dark:stroke-zinc-700" />
          <rect
            x={column.x - column.width / 2}
            y={32}
            width={column.width}
            height={44}
            rx={6}
            fill={column.participant.shape === "actor" ? "transparent" : colorOf(column.participant.colorKey)}
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={1.5}
          />
          <text x={column.x} y={54} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={600} fill={readableTextOn(colorOf(column.participant.colorKey))}>
            {column.participant.label}
          </text>
        </g>
      ))}
      {layout.frames.map((frame) => (
        <rect
          key={frame.block.id}
          x={frame.left}
          y={frame.top}
          width={frame.right - frame.left}
          height={frame.bottom - frame.top}
          fill="none"
          strokeWidth={1.5}
          className="stroke-zinc-400"
        />
      ))}
      {layout.rows.map((row) => {
        if (row.step.type === "block" || row.step.type === "else" || row.step.type === "end") return null;
        if (row.step.type === "note") {
          const x = xOf(row.step.over[0]);
          return <rect key={row.step.id} x={x - 70} y={row.y} width={140} height={row.height - 20} rx={4} className="fill-amber-100 stroke-amber-300 dark:fill-amber-950 dark:stroke-amber-800" />;
        }
        const from = xOf(row.step.from);
        const to = xOf(row.step.to);
        const dashed = row.step.kind === "reply" ? "8 6" : undefined;
        if (from === to) {
          return <path key={row.step.id} d={`M${from} ${row.y}h36v24h-36`} fill="none" strokeWidth={2} strokeDasharray={dashed} className="stroke-zinc-500" />;
        }
        return <line key={row.step.id} x1={from} x2={to} y1={row.y} y2={row.y} strokeWidth={2} strokeDasharray={dashed} className="stroke-zinc-500" />;
      })}
    </svg>
  );
}
