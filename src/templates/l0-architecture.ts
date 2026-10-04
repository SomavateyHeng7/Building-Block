import { createId } from "@/lib/diagram/factory";
import { DEFAULT_LEGEND } from "@/lib/diagram/defaultLegend";
import type { BlockColorKey, Diagram, DiagramNode } from "@/lib/diagram/types";
import type { TemplateDefinition } from "./types";

interface BlockSpec {
  label: string;
  colorKey: BlockColorKey;
}

interface ContainerSpec {
  label: string;
  blocks: BlockSpec[];
}

const LAYOUT: ContainerSpec[] = [
  {
    label: "Digital Engagement Channels",
    blocks: [
      { label: "Customer Portal", colorKey: "product" },
      { label: "Mobile App", colorKey: "product" },
      { label: "Chatbot Assistant", colorKey: "ai-focus" },
      { label: "Partner Mini Apps", colorKey: "third-party" },
    ],
  },
  {
    label: "Core Systems",
    blocks: [
      { label: "Customer Profile Service", colorKey: "microservice" },
      { label: "Billing Engine", colorKey: "replacement" },
      { label: "Order Management", colorKey: "enhancement" },
      { label: "Loyalty Service", colorKey: "new" },
    ],
  },
  {
    label: "Integration Layer",
    blocks: [
      { label: "API Gateway", colorKey: "rest-api" },
      { label: "Event Bus", colorKey: "rest-api" },
      { label: "Legacy Adapter", colorKey: "non-existent" },
    ],
  },
  {
    label: "Network & Infrastructure",
    blocks: [
      { label: "Core Network", colorKey: "product" },
      { label: "Cloud Hosting", colorKey: "third-party" },
      { label: "Monitoring & Observability", colorKey: "microservice" },
    ],
  },
];

const CONTAINER_WIDTH = 300;
const CONTAINER_GAP_X = 40;
const CONTAINER_TOP = 60;
const BLOCK_WIDTH = 260;
const BLOCK_HEIGHT = 48;
const BLOCK_GAP_Y = 12;
const BLOCK_TOP_OFFSET = 48;

function buildNodes(): DiagramNode[] {
  const nodes: DiagramNode[] = [];

  LAYOUT.forEach((container, columnIndex) => {
    const containerId = createId("container");
    const containerHeight =
      BLOCK_TOP_OFFSET + container.blocks.length * (BLOCK_HEIGHT + BLOCK_GAP_Y) + 16;
    const containerX = columnIndex * (CONTAINER_WIDTH + CONTAINER_GAP_X);

    nodes.push({
      id: containerId,
      type: "container",
      position: { x: containerX, y: CONTAINER_TOP },
      size: { width: CONTAINER_WIDTH, height: containerHeight },
      data: { kind: "container", label: container.label },
    });

    container.blocks.forEach((block, rowIndex) => {
      nodes.push({
        id: createId("block"),
        type: "block",
        position: { x: 20, y: BLOCK_TOP_OFFSET + rowIndex * (BLOCK_HEIGHT + BLOCK_GAP_Y) },
        size: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT },
        parentId: containerId,
        data: {
          kind: "block",
          label: block.label,
          colorKey: block.colorKey,
          containerId,
        },
      });
    });
  });

  return nodes;
}

function build(): Diagram {
  const now = new Date().toISOString();
  const sectionId = createId("section");
  return {
    schemaVersion: 1,
    id: createId("diagram"),
    name: "L0 Architecture",
    legend: DEFAULT_LEGEND.map((entry) => ({ ...entry })),
    sections: [{ id: sectionId, name: "Overview", nodes: buildNodes() }],
    activeSectionId: sectionId,
    createdAt: now,
    updatedAt: now,
  };
}

export const l0ArchitectureTemplate: TemplateDefinition = {
  id: "l0-architecture",
  name: "L0 Architecture",
  description:
    "A generic multi-layer system architecture: engagement channels, core systems, integration layer, and infrastructure, color-coded by component type.",
  build,
};
