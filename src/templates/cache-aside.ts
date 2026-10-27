import { buildSequenceDiagram, type ParticipantSpec, type StepSpec } from "./sequence-build";
import type { TemplateDefinition } from "./types";

const PARTICIPANTS: ParticipantSpec[] = [
  ["Client", "product"],
  ["Catalogue Service", "microservice"],
  ["Cache", "new"],
  ["Database", "product"],
  ["Event Broker", "rest-api"],
];

const STEPS: StepSpec[] = [
  ["Client", "Catalogue Service", "Get product 42", "REST"],
  ["Catalogue Service", "Cache", "GET product:42", "Redis"],
  ["Cache", "Catalogue Service", "Miss", undefined, "reply"],
  ["Catalogue Service", "Database", "Select product 42", "SQL"],
  ["Database", "Catalogue Service", "Product row", undefined, "reply"],
  ["Catalogue Service", "Cache", "SET product:42 (TTL 10 min)", "Redis", "async"],
  ["Catalogue Service", "Client", "Product", undefined, "reply"],
  ["note", "Client,Catalogue Service", "The next read within 10 minutes is served from the cache"],
  ["Database", "Event Broker", "ProductUpdated", "CDC", "async"],
  ["Event Broker", "Catalogue Service", "ProductUpdated", "Kafka", "async"],
  ["Catalogue Service", "Cache", "DEL product:42", "Redis"],
];

export const cacheAsideTemplate: TemplateDefinition = {
  id: "cache-aside",
  name: "Cached read (cache-aside)",
  description: "Read through a cache: a miss goes to the database and fills the cache, and a change event clears it again.",
  build: () => buildSequenceDiagram("Cached read", "Cache-aside", PARTICIPANTS, STEPS),
};
