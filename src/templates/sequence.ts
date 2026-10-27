import { buildSequenceDiagram, type ParticipantSpec, type StepSpec } from "./sequence-build";
import type { TemplateDefinition } from "./types";

const PARTICIPANTS: ParticipantSpec[] = [
  ["Customer", "actor"],
  ["Web Shop", "product"],
  ["Orders Service", "microservice"],
  ["Payment Gateway", "third-party"],
  ["Notification Service", "microservice"],
];

const STEPS: StepSpec[] = [
  ["Customer", "Web Shop", "Place order"],
  ["Web Shop", "Orders Service", "Create order", "REST"],
  ["Orders Service", "Orders Service", "Check stock"],
  ["Orders Service", "Payment Gateway", "Authorise payment", "REST"],
  ["Payment Gateway", "Orders Service", "Payment authorised", undefined, "reply"],
  ["note", "Orders Service", "Retries twice if the gateway times out, then cancels the order"],
  ["Orders Service", "Notification Service", "OrderConfirmed", "Kafka", "async"],
  ["Orders Service", "Web Shop", "Order number", undefined, "reply"],
  ["Web Shop", "Customer", "Confirmation page", undefined, "reply"],
  ["Notification Service", "Customer", "Confirmation email", "SMTP", "async"],
];

export const sequenceTemplate: TemplateDefinition = {
  id: "sequence",
  name: "Sequence diagram",
  description: "A checkout flow step by step: who calls whom, in what order, sync or async. Pair it with an L0 tab to explain how the architecture is used.",
  build: () => buildSequenceDiagram("Checkout flow", "Checkout", PARTICIPANTS, STEPS),
};
