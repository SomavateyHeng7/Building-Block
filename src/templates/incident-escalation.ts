import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

/** Lanes sit next to the team they hand work to, so every hand-off runs between neighbouring lanes. */
const CANVAS: CanvasSpec = {
  columns: [
    [
      {
        label: "Customer",
        components: [
          { label: "Report Issue", colorKey: "third-party" },
          { label: "Confirm Resolution", colorKey: "third-party" },
        ],
      },
    ],
    [
      {
        label: "Support",
        components: [
          { label: "Triage Ticket", colorKey: "product", description: "Reproduce it, judge the impact, check for a known fix." },
          { label: "Escalate to On-call", colorKey: "enhancement" },
          { label: "Close Ticket", colorKey: "product" },
        ],
      },
    ],
    [
      {
        label: "Incident Manager",
        components: [
          { label: "Declare Incident", colorKey: "enhancement", description: "Sets the severity and opens the incident channel." },
          { label: "Post Status Update", colorKey: "product" },
        ],
      },
    ],
    [
      {
        label: "Engineering",
        components: [
          { label: "Investigate Cause", colorKey: "microservice" },
          { label: "Deploy Fix", colorKey: "microservice" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Report Issue", to: "Triage Ticket", label: "Ticket" },
    { from: "Triage Ticket", to: "Escalate to On-call", label: "Needs engineering" },
    { from: "Escalate to On-call", to: "Declare Incident", label: "Page on-call" },
    { from: "Declare Incident", to: "Investigate Cause", label: "Assign engineer" },
    { from: "Investigate Cause", to: "Deploy Fix", label: "Root cause found" },
    { from: "Deploy Fix", to: "Post Status Update", label: "Fix live" },
    { from: "Post Status Update", to: "Close Ticket", label: "Customers told" },
    { from: "Close Ticket", to: "Confirm Resolution", label: "Resolved" },
    { from: "Confirm Resolution", to: "Triage Ticket", label: "Still broken, reopen", dashed: true, sides: ["top", "top"] },
  ],
};

export const incidentEscalationTemplate: TemplateDefinition = {
  id: "incident-escalation",
  name: "Incident escalation",
  description:
    "A swimlane view of how a customer problem becomes an incident: support triage, the incident manager, the engineers who fix it and how the customer is told.",
  category: "Process",
  keywords: ["incident", "support", "escalation", "on-call", "outage", "swimlane", "sre", "lanes"],
  orientable: true,
  build: ({ orientation } = {}) => buildDiagram("Incident Escalation", [{ name: "Overview", canvas: CANVAS }], { orientation }),
};
