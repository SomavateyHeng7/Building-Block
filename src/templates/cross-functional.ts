import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

/** One lane per team (a container), steps top to bottom inside it, hand-offs as connections between lanes. */
const CANVAS: CanvasSpec = {
  columns: [
    [
      {
        label: "Requester",
        components: [
          { label: "Draft Request", colorKey: "product" },
          { label: "Submit Request", colorKey: "product" },
        ],
      },
    ],
    [
      {
        label: "Manager",
        components: [
          { label: "Review Request", colorKey: "product" },
          { label: "Approve Request", colorKey: "enhancement" },
        ],
      },
    ],
    [
      {
        label: "Finance",
        components: [
          { label: "Check Budget", colorKey: "enhancement" },
          { label: "Allocate Funds", colorKey: "product" },
          { label: "Pay Supplier", colorKey: "product" },
        ],
      },
    ],
    [
      {
        label: "Procurement",
        components: [
          { label: "Select Supplier", colorKey: "product" },
          { label: "Issue Purchase Order", colorKey: "product" },
          { label: "Receive Goods", colorKey: "product" },
          { label: "Close Request", colorKey: "product" },
        ],
      },
    ],
    [
      {
        label: "Supplier",
        components: [
          { label: "Confirm Order", colorKey: "third-party" },
          { label: "Deliver Goods", colorKey: "third-party" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Draft Request", to: "Submit Request", label: "Ready" },
    { from: "Submit Request", to: "Review Request", label: "Request" },
    { from: "Review Request", to: "Approve Request", label: "Reviewed" },
    { from: "Approve Request", to: "Check Budget", label: "Approved" },
    { from: "Check Budget", to: "Allocate Funds", label: "Within budget" },
    { from: "Allocate Funds", to: "Select Supplier", label: "Funds reserved" },
    { from: "Select Supplier", to: "Issue Purchase Order", label: "Chosen supplier" },
    { from: "Issue Purchase Order", to: "Confirm Order", label: "Purchase order" },
    { from: "Confirm Order", to: "Deliver Goods", label: "Confirmed" },
    { from: "Deliver Goods", to: "Receive Goods", label: "Goods and invoice" },
    { from: "Receive Goods", to: "Pay Supplier", label: "Goods received" },
    { from: "Pay Supplier", to: "Close Request", label: "Payment made" },
    { from: "Approve Request", to: "Draft Request", label: "Rejected, revise", dashed: true, sides: ["top", "top"] },
    { from: "Check Budget", to: "Review Request", label: "Over budget", dashed: true, sides: ["top", "top"] },
  ],
};

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
