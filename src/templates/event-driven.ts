import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

/** What the Order Service is made of, so the template shows an internal design (L2). */
const ORDER_SERVICE: CanvasSpec = {
  columns: [
    [{ label: "API", components: [{ label: "Order Controller", colorKey: "microservice", technology: "REST" }] }],
    [
      {
        label: "Domain",
        components: [
          { label: "Order Aggregate", colorKey: "microservice" },
          { label: "Pricing Rules", colorKey: "enhancement" },
        ],
      },
    ],
    [
      {
        label: "Persistence",
        components: [
          { label: "Orders Database", colorKey: "product", technology: "PostgreSQL" },
          { label: "Outbox Relay", colorKey: "new", technology: "Transactional outbox" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Order Controller", to: "Order Aggregate", label: "Commands", protocol: "In-process" },
    { from: "Order Aggregate", to: "Orders Database", label: "Orders and outbox rows", protocol: "SQL" },
    { from: "Orders Database", to: "Outbox Relay", label: "Pending events", protocol: "SQL polling", dashed: true },
  ],
};

const CANVAS: CanvasSpec = {
  columns: [
    [
      {
        label: "Clients",
        components: [
          { label: "Web Shop", colorKey: "product" },
          { label: "Mobile App", colorKey: "product" },
        ],
      },
    ],
    [{ label: "Edge", components: [{ label: "API Gateway", colorKey: "rest-api" }] }],
    [
      {
        label: "Order Services",
        components: [
          {
            label: "Order Service",
            colorKey: "microservice",
            description: "Takes orders and publishes order events.",
            detail: ORDER_SERVICE,
          },
          { label: "Payment Service", colorKey: "microservice" },
        ],
      },
    ],
    [
      { label: "Messaging", components: [{ label: "Event Broker", colorKey: "rest-api", technology: "Kafka" }] },
      { label: "External", components: [{ label: "Payment Provider", colorKey: "third-party" }] },
    ],
    [
      {
        label: "Downstream Services",
        components: [
          { label: "Inventory Service", colorKey: "microservice" },
          { label: "Notification Service", colorKey: "new" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Web Shop", to: "API Gateway", label: "Orders", protocol: "HTTPS" },
    { from: "Mobile App", to: "API Gateway", label: "Orders", protocol: "HTTPS" },
    { from: "API Gateway", to: "Order Service", label: "Orders", protocol: "REST" },
    { from: "Order Service", to: "Payment Service", label: "Payment requests", protocol: "REST" },
    { from: "Order Service", to: "Event Broker", label: "Order events", protocol: "Kafka", dashed: true },
    { from: "Event Broker", to: "Inventory Service", label: "Order events", protocol: "Kafka", dashed: true },
    { from: "Event Broker", to: "Notification Service", label: "Order events", protocol: "Kafka", dashed: true },
    { from: "Payment Service", to: "Payment Provider", label: "Payments", protocol: "REST" },
  ],
};

export const eventDrivenTemplate: TemplateDefinition = {
  id: "event-driven",
  name: "Event-driven microservices",
  description:
    "Services that talk through an event broker, behind an API gateway. The Order Service has an internal design (L2) to open.",
  build: () => buildDiagram("Event-driven Microservices", [{ name: "Overview", canvas: CANVAS }]),
};
