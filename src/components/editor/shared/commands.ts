/**
 * Actions owned by one part of the editor (the toolbar's export, the file menu…) that another part (the command
 * palette) needs to start. The owner registers them while it is mounted; anyone can run one by name.
 */
export type CommandId =
  | "new"
  | "open"
  | "import"
  | "save"
  | "save-as"
  | "history"
  | "merge-comments"
  | "export"
  | "copy-image";

const registry = new Map<CommandId, () => void>();

/** Registers commands and returns the function that removes them again. Registering a name again replaces it. */
export function registerCommands(commands: Partial<Record<CommandId, () => void>>): () => void {
  const added = Object.entries(commands) as [CommandId, () => void][];
  for (const [id, run] of added) registry.set(id, run);
  return () => {
    for (const [id, run] of added) if (registry.get(id) === run) registry.delete(id);
  };
}

/** Whether something is currently offering the command (view mode, for one, leaves some out). */
export function hasCommand(id: CommandId): boolean {
  return registry.has(id);
}

/** Runs a registered command. Returns false when nothing offers it. */
export function runCommand(id: CommandId): boolean {
  const run = registry.get(id);
  if (!run) return false;
  run();
  return true;
}
