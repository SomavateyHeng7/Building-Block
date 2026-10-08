import { useDiagramStore } from "@/lib/diagram/store";

export type LevelStatus = "Available now" | "Coming next" | "Planned";

interface LevelDefinition {
  level: string;
  title: string;
  body: string;
  /**
   * Editor actions this level needs. A level is available once every one exists in the diagram store, so
   * the roadmap follows the code: shipping the feature flips its status, with nothing to edit by hand.
   */
  requires: string[];
}

const LEVEL_DEFINITIONS: LevelDefinition[] = [
  {
    level: "L0",
    title: "Landscape",
    body: "Systems and components grouped into domains, coloured by change type.",
    requires: ["addContainer", "addBlock", "addLegendEntry"],
  },
  {
    level: "L1",
    title: "Interactions",
    body: "How the components talk to each other: connections with protocols and what flows, drawn right on the L0 canvas.",
    requires: ["addConnection", "updateConnection", "deleteConnections"],
  },
  {
    level: "L2",
    title: "Component detail",
    body: "Drill down from any L1 component into its internal design, kept linked to the level above.",
    // Nothing in the store does this yet. Add the action with this name (or change the name here) when it exists.
    requires: ["linkComponentToDiagram"],
  },
];

export interface Level extends Omit<LevelDefinition, "requires"> {
  status: LevelStatus;
}

/** Levels with their status worked out from what the editor can do; the first unbuilt one is "next". */
export function getLevels(): Level[] {
  const store = useDiagramStore.getState() as unknown as Record<string, unknown>;
  const built = (definition: LevelDefinition) => definition.requires.every((name) => typeof store[name] === "function");
  let nextClaimed = false;
  return LEVEL_DEFINITIONS.map(({ requires, ...level }) => {
    const definition = { ...level, requires };
    if (built(definition)) return { ...level, status: "Available now" };
    if (!nextClaimed) {
      nextClaimed = true;
      return { ...level, status: "Coming next" };
    }
    return { ...level, status: "Planned" };
  });
}

function joinNames(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
}

/** "L0 and L1 today, L2 next", worked out from the same statuses. */
export function roadmapHeading(levels: Level[]): string {
  const available = levels.filter((level) => level.status === "Available now").map((level) => level.level);
  const next = levels.filter((level) => level.status !== "Available now").map((level) => level.level);
  if (!next.length) return `${joinNames(available)} are all available`;
  if (!available.length) return `${joinNames(next)} are on the way`;
  return `${joinNames(available)} today, ${joinNames(next)} next`;
}
