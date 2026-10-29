/**
 * What's new, newest first, for /changelog. Written for the people who use the app, not for developers: say what
 * they can now do, in a sentence. Add an entry when a release adds or changes something people will notice.
 */
export interface ChangelogEntry {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-10-30",
    title: "Review comments, version history and diagram code",
    changes: [
      "Add review comments to components and connections. Send the file to a reviewer, then merge their comments back with File → Merge comments from a file.",
      "Save named checkpoints in File → Version history, restore one, or open it as tabs and compare it with the current diagram.",
      "Export a tab as a Mermaid flowchart or as C4-PlantUML, for documentation kept in git.",
      "Add a link to a ticket, decision record or document on any component.",
      "Version history can now show what changed since a checkpoint, tab by tab, without adding tabs.",
      "Screen readers now hear what is selected (its category, technology, connections and open comments), what was added or removed, and which tab you are on. Keyboard focus is clearly visible on boxes and connections, and every dialog keeps Tab inside it.",
      "Components and connections with open comments now show a blue badge with the count; click it to read and reply.",
      "New solution document export: Markdown with each tab's components and connections, internal designs, the legend, open comments and version history. Choose PNG too to link the pictures.",
    ],
  },
  {
    date: "2026-10-29",
    title: "Reuse your work, and share it with reviewers",
    changes: [
      "Save a legend to a file and add it to any other diagram (Legend → Reuse).",
      "Start a new diagram from your own file on the Templates page: you get a copy, and the file is never changed.",
      "Add a logo and an accent colour to exports. They are saved in the diagram file and used by PNG, SVG, PDF and the viewer.",
      "New interactive viewer export: one HTML file with a tab per view, pan and zoom, that opens offline.",
      "Add the colours of C4 or ArchiMate to a legend with one click.",
    ],
  },
  {
    date: "2026-10-28",
    title: "Check before you share, and clearer saving",
    changes: [
      "The new Check button lists components nothing connects to, connections without a protocol and components without an owner, and takes you to each.",
      "Importing from draw.io now lays out components that were piled on top of each other.",
      "In browsers that can't save over a file (Safari and Firefox), Building Block now confirms each download, shows when you last downloaded, and reminds you every 5 minutes while changes are unsaved.",
    ],
  },
];
