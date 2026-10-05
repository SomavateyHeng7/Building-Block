import type { Rect } from "@xyflow/react";
import { downloadBlob, fileBaseName } from "./persistence";
import type { Diagram, DiagramSection, LegendEntry } from "./types";

const PADDING = 40;
const HEADER_HEIGHT = 52;
const LEGEND_ROW_HEIGHT = 22;
const SWATCH = 14;
/** Keeps very large diagrams under browser canvas size limits. */
const MAX_CANVAS_SIDE = 12000;
const FONT_FAMILY = "Arial, Helvetica, sans-serif";

export interface ImageExportOptions {
  /** React Flow's `.react-flow__viewport` element. */
  viewport: HTMLElement;
  /** Canvas-space bounds of every node in the section. */
  bounds: Rect;
  title: string;
  legend: LegendEntry[];
  dark: boolean;
  filename: string;
}

/** Legend entries actually used in a section, in legend order. */
export function legendUsedIn(diagram: Diagram, section: DiagramSection): LegendEntry[] {
  const used = new Set(section.nodes.map((node) => node.data.colorKey).filter(Boolean));
  return diagram.legend.filter((entry) => used.has(entry.key));
}

export function exportTitle(diagram: Diagram, section: DiagramSection): string {
  return diagram.sections.length > 1 ? `${diagram.name} — ${section.name}` : diagram.name;
}

/** Renders the diagram at 1:1 zoom with a title above and the legend below. */
async function renderComposite(
  options: ImageExportOptions,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const { toCanvas } = await import("html-to-image");
  const { viewport, bounds, title, legend, dark } = options;

  const width = Math.ceil(bounds.width + PADDING * 2);
  const height = Math.ceil(bounds.height + PADDING * 2);
  const colors = dark
    ? { background: "#0a0a0a", text: "#ededed", muted: "#a1a1aa", swatchBorder: "rgba(255,255,255,0.3)" }
    : { background: "#ffffff", text: "#171717", muted: "#52525b", swatchBorder: "rgba(0,0,0,0.25)" };

  // Legend layout: items flow left to right and wrap at the image width.
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `12px ${FONT_FAMILY}`;
  const items: { entry: LegendEntry; x: number; row: number }[] = [];
  let x = PADDING;
  let row = 0;
  for (const entry of legend) {
    const itemWidth = SWATCH + 6 + measure.measureText(entry.label).width + 20;
    if (x + itemWidth > Math.max(width, 480) - PADDING && x > PADDING) {
      row += 1;
      x = PADDING;
    }
    items.push({ entry, x, row });
    x += itemWidth;
  }
  const legendHeight = legend.length ? 28 + (row + 1) * LEGEND_ROW_HEIGHT + PADDING / 2 : 0;
  const totalWidth = Math.max(width, legend.length ? 480 : 0);
  const totalHeight = HEADER_HEIGHT + height + legendHeight;

  const pixelRatio = Math.min(2, MAX_CANVAS_SIDE / Math.max(totalWidth, totalHeight));
  const diagramCanvas = await toCanvas(viewport, {
    backgroundColor: colors.background,
    width,
    height,
    pixelRatio,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px) scale(1)`,
    },
    // Leave resize handles out of the picture.
    filter: (node) => !node.classList?.contains("react-flow__resize-control"),
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(totalWidth * pixelRatio);
  canvas.height = Math.round(totalHeight * pixelRatio);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(pixelRatio, pixelRatio);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  ctx.fillStyle = colors.text;
  ctx.font = `bold 18px ${FONT_FAMILY}`;
  ctx.textBaseline = "middle";
  ctx.fillText(title, PADDING, HEADER_HEIGHT / 2 + 8);

  ctx.drawImage(diagramCanvas, 0, HEADER_HEIGHT, width, height);

  if (legend.length) {
    const legendTop = HEADER_HEIGHT + height;
    ctx.fillStyle = colors.muted;
    ctx.font = `bold 11px ${FONT_FAMILY}`;
    ctx.fillText("LEGEND", PADDING, legendTop + 12);
    ctx.font = `12px ${FONT_FAMILY}`;
    for (const item of items) {
      const y = legendTop + 28 + item.row * LEGEND_ROW_HEIGHT;
      ctx.fillStyle = item.entry.color;
      ctx.fillRect(item.x, y, SWATCH, SWATCH);
      ctx.strokeStyle = colors.swatchBorder;
      ctx.strokeRect(item.x + 0.5, y + 0.5, SWATCH - 1, SWATCH - 1);
      ctx.fillStyle = colors.text;
      ctx.fillText(item.entry.label, item.x + SWATCH + 6, y + SWATCH / 2);
    }
  }

  return { canvas, width: totalWidth, height: totalHeight };
}

export async function exportPng(options: ImageExportOptions): Promise<void> {
  const { canvas } = await renderComposite(options);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not render PNG");
  downloadBlob(blob, `${fileBaseName(options.filename)}.png`);
}

/** One page sized to the diagram, so nothing is scaled down or cropped. */
export async function exportPdf(options: ImageExportOptions): Promise<void> {
  const [{ canvas, width, height }, { jsPDF }] = await Promise.all([
    renderComposite(options),
    import("jspdf"),
  ]);
  const pdf = new jsPDF({
    orientation: width >= height ? "landscape" : "portrait",
    unit: "pt",
    format: [width, height],
  });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, width, height);
  pdf.save(`${fileBaseName(options.filename)}.pdf`);
}

/** Every container and component in every section, for the solution document's component catalogue. */
export function exportComponentsCsv(diagram: Diagram): void {
  const categories = new Map(diagram.legend.map((entry) => [entry.key, entry.label]));
  const rows: string[][] = [
    ["Section", "Type", "Name", "Container", "Category", "Technology", "Owner", "Description", "Notes"],
  ];
  for (const section of diagram.sections) {
    for (const node of section.nodes) {
      const parent = section.nodes.find((candidate) => candidate.id === node.parentId);
      rows.push([
        section.name,
        node.type === "container" ? "Container" : "Component",
        node.data.label,
        parent?.data.label ?? "",
        node.data.colorKey ? (categories.get(node.data.colorKey) ?? "") : "",
        node.data.technology ?? "",
        node.data.owner ?? "",
        node.data.description ?? "",
        node.data.notes ?? "",
      ]);
    }
  }
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\r\n");
  // The BOM makes Excel read the file as UTF-8.
  downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${fileBaseName(diagram.name)}-components.csv`);
}
