/**
 * Upper bounds on what a file may hold, so a huge or hostile file is refused with a message instead of
 * freezing the tab. Well above real diagrams (the perf baselines use 2,000 components a tab).
 */

/** The biggest diagram, draw.io or Mermaid file that is read. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** The most a compressed draw.io page may expand to. */
export const MAX_INFLATED_BYTES = 50 * 1024 * 1024;

export const MAX_SECTIONS = 100;
/** Per canvas: a tab or a component's internal design. */
export const MAX_NODES = 5_000;
export const MAX_EDGES = 10_000;
export const MAX_PARTICIPANTS = 200;
export const MAX_STEPS = 5_000;

/** Names and labels (tabs, components, participants, legend entries); longer ones are cut. */
export const MAX_NAME_LENGTH = 200;
/** Any other text: notes, descriptions, message labels. */
export const MAX_TEXT_LENGTH = 10_000;
/** One line of Mermaid. The line patterns slow down badly on very long lines, and no real line comes close. */
export const MAX_MERMAID_LINE = 2_000;

const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** The message for a file over MAX_FILE_BYTES, or null if its size is fine. */
export function fileSizeProblem(file: { name: string; size: number }): string | null {
  return file.size > MAX_FILE_BYTES ? `"${file.name}" is too large (the limit is ${megabytes(MAX_FILE_BYTES)}).` : null;
}
