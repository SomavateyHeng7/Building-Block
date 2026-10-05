import type { ContainerStyle, DiagramNode, Position, Size } from "./types";

/** Inner spacing of a container; the side with the header leaves room for it. */
export const CONTAINER_PADDING = 16;
export const CONTAINER_HEADER = 40;
export const LAYOUT_GAP = 12;
export const CONTAINER_MIN: Size = { width: 200, height: 120 };

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Where a container's children may start and end, depending on which side its header is on. */
export function containerInsets(style?: ContainerStyle): Insets {
  const side = style?.headerPosition ?? "top";
  const inset = (edge: keyof Insets) => (edge === side ? CONTAINER_HEADER : CONTAINER_PADDING);
  return { top: inset("top"), right: inset("right"), bottom: inset("bottom"), left: inset("left") };
}

function insetsOf(nodes: DiagramNode[], containerId: string): Insets {
  const container = nodes.find((node) => node.id === containerId);
  return containerInsets(container?.data.kind === "container" ? container.data : undefined);
}

export type ArrangeOp =
  | "align-left"
  | "align-center"
  | "align-right"
  | "align-top"
  | "align-middle"
  | "align-bottom"
  | "distribute-horizontal"
  | "distribute-vertical"
  | "same-width"
  | "same-height";

/** Canvas position, adding the parent container's offset for nested nodes. */
export function absolutePosition(node: DiagramNode, nodes: DiagramNode[]): Position {
  const parent = node.parentId ? nodes.find((candidate) => candidate.id === node.parentId) : undefined;
  return parent
    ? { x: node.position.x + parent.position.x, y: node.position.y + parent.position.y }
    : node.position;
}

/** Aligns, distributes or matches the size of the given nodes, working in canvas coordinates. */
export function arrangeNodes(nodes: DiagramNode[], ids: string[], op: ArrangeOp): DiagramNode[] {
  const targets = nodes
    .filter((node) => ids.includes(node.id))
    .map((node) => ({ node, abs: absolutePosition(node, nodes) }));
  if (targets.length < 2) return nodes;

  const left = Math.min(...targets.map((t) => t.abs.x));
  const top = Math.min(...targets.map((t) => t.abs.y));
  const right = Math.max(...targets.map((t) => t.abs.x + t.node.size.width));
  const bottom = Math.max(...targets.map((t) => t.abs.y + t.node.size.height));
  const widest = Math.max(...targets.map((t) => t.node.size.width));
  const tallest = Math.max(...targets.map((t) => t.node.size.height));

  const next = new Map<string, { abs: Position; size: Size }>();
  const place = (id: string, abs: Position, size: Size) => next.set(id, { abs, size });

  if (op === "distribute-horizontal" || op === "distribute-vertical") {
    const horizontal = op === "distribute-horizontal";
    const sorted = [...targets].sort((a, b) => (horizontal ? a.abs.x - b.abs.x : a.abs.y - b.abs.y));
    const span = horizontal ? right - left : bottom - top;
    const occupied = sorted.reduce(
      (sum, t) => sum + (horizontal ? t.node.size.width : t.node.size.height),
      0,
    );
    const gap = (span - occupied) / (sorted.length - 1);
    let cursor = horizontal ? left : top;
    for (const t of sorted) {
      place(t.node.id, horizontal ? { x: cursor, y: t.abs.y } : { x: t.abs.x, y: cursor }, t.node.size);
      cursor += (horizontal ? t.node.size.width : t.node.size.height) + gap;
    }
  } else {
    for (const { node, abs } of targets) {
      const { width, height } = node.size;
      switch (op) {
        case "align-left":
          place(node.id, { x: left, y: abs.y }, node.size);
          break;
        case "align-center":
          place(node.id, { x: (left + right) / 2 - width / 2, y: abs.y }, node.size);
          break;
        case "align-right":
          place(node.id, { x: right - width, y: abs.y }, node.size);
          break;
        case "align-top":
          place(node.id, { x: abs.x, y: top }, node.size);
          break;
        case "align-middle":
          place(node.id, { x: abs.x, y: (top + bottom) / 2 - height / 2 }, node.size);
          break;
        case "align-bottom":
          place(node.id, { x: abs.x, y: bottom - height }, node.size);
          break;
        case "same-width":
          place(node.id, abs, { width: widest, height });
          break;
        case "same-height":
          place(node.id, abs, { width, height: tallest });
          break;
      }
    }
  }

  return nodes.map((node) => {
    const placed = next.get(node.id);
    if (!placed) return node;
    const parent = node.parentId ? nodes.find((candidate) => candidate.id === node.parentId) : undefined;
    const position = parent
      ? { x: placed.abs.x - parent.position.x, y: placed.abs.y - parent.position.y }
      : placed.abs;
    return { ...node, position: snap(position), size: placed.size };
  });
}

function childrenOf(nodes: DiagramNode[], containerId: string) {
  return nodes.filter((node) => node.parentId === containerId);
}

function snap(position: Position): Position {
  return { x: Math.round(position.x), y: Math.round(position.y) };
}

/** Grows (never shrinks) a container so all of its children fit inside. */
export function growContainerToFit(nodes: DiagramNode[], containerId: string): DiagramNode[] {
  const children = childrenOf(nodes, containerId);
  if (!children.length) return nodes;
  const insets = insetsOf(nodes, containerId);
  const needWidth = Math.max(...children.map((c) => c.position.x + c.size.width)) + insets.right;
  const needHeight = Math.max(...children.map((c) => c.position.y + c.size.height)) + insets.bottom;
  return nodes.map((node) =>
    node.id === containerId && (needWidth > node.size.width || needHeight > node.size.height)
      ? {
          ...node,
          size: {
            width: Math.max(node.size.width, needWidth),
            height: Math.max(node.size.height, needHeight),
          },
        }
      : node,
  );
}

/** Shrinks or grows a container to wrap its children with standard padding. */
export function fitContainerToContents(nodes: DiagramNode[], containerId: string): DiagramNode[] {
  const children = childrenOf(nodes, containerId);
  if (!children.length) return nodes;
  const insets = insetsOf(nodes, containerId);
  const minX = Math.min(...children.map((c) => c.position.x));
  const minY = Math.min(...children.map((c) => c.position.y));
  const dx = insets.left - minX;
  const dy = insets.top - minY;
  const maxX = Math.max(...children.map((c) => c.position.x + c.size.width)) + dx;
  const maxY = Math.max(...children.map((c) => c.position.y + c.size.height)) + dy;

  return nodes.map((node) => {
    if (node.parentId === containerId) {
      return { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } };
    }
    if (node.id === containerId) {
      return {
        ...node,
        // Keep children where they are on screen by moving the container by the same offset.
        position: { x: node.position.x - dx, y: node.position.y - dy },
        size: {
          width: Math.max(CONTAINER_MIN.width, maxX + insets.right),
          height: Math.max(CONTAINER_MIN.height, maxY + insets.bottom),
        },
      };
    }
    return node;
  });
}

/**
 * Lays a container's children out in a grid (reading order is kept) using the
 * container's current width, then fits the container's height to the grid.
 */
export function tidyContainer(nodes: DiagramNode[], containerId: string): DiagramNode[] {
  const container = nodes.find((node) => node.id === containerId);
  const children = childrenOf(nodes, containerId).sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
  );
  if (!container || !children.length) return nodes;
  const insets = insetsOf(nodes, containerId);

  const cellWidth = Math.max(...children.map((c) => c.size.width));
  const cellHeight = Math.max(...children.map((c) => c.size.height));
  const usableWidth = container.size.width - insets.left - insets.right;
  const columns = Math.max(1, Math.floor((usableWidth + LAYOUT_GAP) / (cellWidth + LAYOUT_GAP)));
  const rows = Math.ceil(children.length / columns);

  const positions = new Map(
    children.map((child, index) => [
      child.id,
      {
        x: insets.left + (index % columns) * (cellWidth + LAYOUT_GAP),
        y: insets.top + Math.floor(index / columns) * (cellHeight + LAYOUT_GAP),
      },
    ]),
  );

  return nodes.map((node) => {
    const position = positions.get(node.id);
    if (position) return { ...node, position };
    if (node.id === containerId) {
      return {
        ...node,
        size: {
          width: Math.max(node.size.width, insets.left + cellWidth + insets.right),
          height: Math.max(
            CONTAINER_MIN.height,
            insets.top + rows * (cellHeight + LAYOUT_GAP) - LAYOUT_GAP + insets.bottom,
          ),
        },
      };
    }
    return node;
  });
}

/** Where a new block should go inside a container: below its lowest child. */
export function nextSlotInContainer(nodes: DiagramNode[], containerId: string): Position {
  const children = childrenOf(nodes, containerId);
  const insets = insetsOf(nodes, containerId);
  if (!children.length) return { x: insets.left, y: insets.top };
  const lowest = Math.max(...children.map((c) => c.position.y + c.size.height));
  return { x: insets.left, y: lowest + LAYOUT_GAP };
}

/**
 * Applies a style change to a container. Moving the header to another side shifts the
 * children and resizes the container, so nothing ends up under the header.
 */
export function restyleContainer(nodes: DiagramNode[], containerId: string, patch: ContainerStyle): DiagramNode[] {
  const container = nodes.find((node) => node.id === containerId);
  if (!container || container.data.kind !== "container") return nodes;
  const before = containerInsets(container.data);
  const after = containerInsets({ ...container.data, ...patch });
  const dx = after.left - before.left;
  const dy = after.top - before.top;
  const hasChildren = nodes.some((node) => node.parentId === containerId);

  return nodes.map((node) => {
    if (node.id === containerId) {
      return {
        ...node,
        data: { ...node.data, ...patch },
        size: hasChildren
          ? {
              width: Math.max(CONTAINER_MIN.width, node.size.width + dx + after.right - before.right),
              height: Math.max(CONTAINER_MIN.height, node.size.height + dy + after.bottom - before.bottom),
            }
          : node.size,
      };
    }
    if (node.parentId === containerId && (dx || dy)) {
      return { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } };
    }
    return node;
  });
}
