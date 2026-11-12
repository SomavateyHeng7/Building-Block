import { buildDiagram, type CanvasSpec, type ConnectionSpec, type ContainerSpec } from "../build";
import type { TemplateDefinition } from "../types";

/**
 * A purchase request as a swimlane: one lane per team (a container), its steps top to bottom inside it,
 * and the hand-offs between teams as connections between lanes.
 */

// ── Lanes, in order left to right ────────────────────────────────────────────

const REQUESTER: ContainerSpec = {
  label: "Requester",
  components: [
    { label: "Draft Request", colorKey: "product" },
    { label: "Submit Request", colorKey: "product" },
  ],
};

const MANAGER: ContainerSpec = {
  label: "Manager",
  components: [
    { label: "Review Request", colorKey: "product" },
    { label: "Approve Request", colorKey: "enhancement" },
  ],
};

const FINANCE: ContainerSpec = {
  label: "Finance",
  components: [
    { label: "Check Budget", colorKey: "enhancement" },
    { label: "Allocate Funds", colorKey: "product" },
    { label: "Pay Supplier", colorKey: "product" },
  ],
};

const PROCUREMENT: ContainerSpec = {
  label: "Procurement",
  components: [
    { label: "Select Supplier", colorKey: "product" },
    { label: "Issue Purchase Order", colorKey: "product" },
    { label: "Receive Goods", colorKey: "product" },
    { label: "Close Request", colorKey: "product" },
  ],
};

const SUPPLIER: ContainerSpec = {
  label: "Supplier",
  components: [
    { label: "Confirm Order", colorKey: "third-party" },
    { label: "Deliver Goods", colorKey: "third-party" },
  ],
};

// ── Connections ──────────────────────────────────────────────────────────────

/** The happy path, in the order it happens. */
const MAIN_FLOW: ConnectionSpec[] = [
  // Request
  { from: "Draft Request", to: "Submit Request", label: "Ready" },
  { from: "Submit Request", to: "Review Request", label: "Request" },
  // Approval
  { from: "Review Request", to: "Approve Request", label: "Reviewed" },
  { from: "Approve Request", to: "Check Budget", label: "Approved" },
  // Budget
  { from: "Check Budget", to: "Allocate Funds", label: "Within budget" },
  { from: "Allocate Funds", to: "Select Supplier", label: "Funds reserved" },
  // Purchase and delivery
  { from: "Select Supplier", to: "Issue Purchase Order", label: "Chosen supplier" },
  { from: "Issue Purchase Order", to: "Confirm Order", label: "Purchase order" },
  { from: "Confirm Order", to: "Deliver Goods", label: "Confirmed" },
  { from: "Deliver Goods", to: "Receive Goods", label: "Goods and invoice" },
  // Payment and close
  { from: "Receive Goods", to: "Pay Supplier", label: "Goods received" },
  { from: "Pay Supplier", to: "Close Request", label: "Payment made" },
];

/**
 * Rework: dashed, and routed per layout so neither runs through a step or shares an end with a forward line.
 */
const LOOP_BACKS: ConnectionSpec[] = [
  {
    from: "Approve Request",
    to: "Draft Request",
    label: "Rejected, revise",
    dashed: true,
    route: {
      // Vertical: over the top would cut through Review Request, which sits just above, and straight across
      // would share a run with "Request". So under Approve Request and up to Draft Request's top; the bend
      // keeps the climb off "Request" and drops the label below that line's.
      vertical: { sides: ["bottom", "top"], bend: { x: 35, y: 60 } },
      // Horizontal: up through the empty end of the Requester lane and back over the top.
      horizontal: { sides: ["top", "top"] },
    },
  },
  {
    from: "Check Budget",
    to: "Review Request",
    label: "Over budget",
    dashed: true,
    route: {
      // Vertical: both are the first step in their lane, so over the top is clear.
      vertical: { sides: ["top", "top"] },
      // Horizontal: the tops take "Approved" and "Request", so go under, through the empty part of Finance.
      horizontal: { sides: ["bottom", "bottom"] },
    },
  },
];

const CANVAS: CanvasSpec = {
  columns: [[REQUESTER], [MANAGER], [FINANCE], [PROCUREMENT], [SUPPLIER]],
  connections: [...MAIN_FLOW, ...LOOP_BACKS],
};

// ── Template ─────────────────────────────────────────────────────────────────

export const crossFunctionalTemplate: TemplateDefinition = {
  id: "cross-functional",
  name: "Cross-functional process",
  description:
    "A swimlane view of a process that crosses teams: one lane per team, the steps inside it and the hand-offs between lanes.",
  category: "Process",
  keywords: ["swimlane", "flowchart", "workflow", "approval", "hand-off", "lanes"],
  orientable: true,
  build: ({ orientation } = {}) =>
    buildDiagram("Cross-functional Process", [{ name: "Overview", canvas: CANVAS }], { orientation }),
};
