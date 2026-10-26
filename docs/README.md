# Building Block — developer documentation

This folder explains how Building Block works and **why it is built the way it is**. The code comments say what
a line does where that isn't obvious; these documents give the bigger picture, the reasoning behind each
decision, and the traps that shaped the code, so a change can be made without breaking a rule nobody wrote
down.

Everything here describes the code in `src/` as committed. If you change behaviour, update the matching page
in the same pull request (see [How to change things](19-how-to.md)).

## Reading order

New to the codebase? Read 1 → 4 first, then whichever area you're working on.

| # | Page | What it covers |
| --- | --- | --- |
| 1 | [Product and principles](01-product-and-principles.md) | What the app is, and the rules every change must keep (no server, files are the only copy) |
| 2 | [Architecture](02-architecture.md) | Layers, stores, how data flows from a click to the canvas, the dependency map |
| 3 | [Routing](03-routing.md) | Every URL, what renders it, redirects, the proxy, maintenance mode, consent gating, error pages |
| 4 | [Data model and file format](04-data-model-and-file-format.md) | Every type, the `.json` file, invariants, how files are validated and repaired |
| 5 | [Diagram store and undo](05-diagram-store-and-undo.md) | `store.ts`: the active view, every action, undo history, coalescing, the clipboard |
| 6 | [Files, saving and unsaved changes](06-files-saving-and-unsaved-changes.md) | Open, Save, autosave, browser differences, dirty tracking, the unsaved-changes guard |
| 7 | [Editor UI](07-editor-ui.md) | Every editor component, the responsive layout, keyboard shortcuts |
| 8 | [Layout and containers](08-layout-and-containers.md) | `layout.ts`: nesting, insets, align/distribute, tidy, fit, drag-and-drop re-parenting |
| 9 | [Connections (L1) and internal designs (L2)](09-connections-and-internal-designs.md) | The architecture levels and how each is stored and edited |
| 10 | [Export](10-export.md) | The export dialog, export plans, rendering images, PDF, SVG, CSV, ZIP |
| 11 | [Privacy, consent and forms](11-privacy-consent-and-forms.md) | The consent gate, privacy notice, waitlist form, the contact page, everything stored in the browser |
| 12 | [Notifications](12-notifications.md) | The toast system and its writing rules |
| 13 | [Public pages](13-public-pages.md) | Landing page, start page, templates, maintenance page, error and 404 pages |
| 14 | [Security](14-security.md) | Threat model, headers, file-parsing hardening, CSV injection, what we deliberately didn't do |
| 15 | [Testing and QA](15-testing-and-qa.md) | The test suite, what each file proves, the manual browser checklist |
| 16 | [Operations](16-operations.md) | Environment variables, deploying, maintenance mode runbook, browser storage keys |
| 17 | [Decision log](17-decision-log.md) | Every significant decision, the alternatives, and why we chose what we did |
| 18 | [File reference](18-file-reference.md) | Every file in the repository and what it is for |
| 19 | [How to change things](19-how-to.md) | Recipes: add a template, an export format, a store action; bump the privacy notice |

## Glossary

| Term | Meaning |
| --- | --- |
| **Diagram** | One document: a name, a legend and one or more tabs. Saved as one `.json` file. |
| **Tab** / **section** | One canvas inside a diagram (e.g. "Current" and "Target"). The code calls it a *section*; the UI calls it a *tab*. |
| **Container** | A box that groups components (e.g. "Core Systems"). Containers can't be nested. |
| **Component** / **block** | A box for a system or service. The code calls it a *block*; the UI calls it a *component*. |
| **Node** | A container or a component: anything drawn on the canvas as a box. |
| **Connection** / **edge** | A line between two components. The code calls it an *edge* (React Flow's word). |
| **Legend** | The list of categories (name + colour) that components are coloured by. Defined per diagram. |
| **L0** | The landscape level: containers and components coloured by the legend. |
| **L1** | The interactions level: connections between components, with what flows and how. |
| **L2** | The internal-design level: what one component is made of, drawn on its own canvas. |
| **View** / **active view** | What the canvas shows right now: a tab, or one component's internal design. |
| **Internal design** / **detail** | A component's L2 canvas. Stored in `BlockNodeData.detail`. |
| **Dirty** | The open diagram has changes that aren't in a file yet. |
| **Handle** | A File System Access API `FileSystemFileHandle`: permission to write back to the file the user opened. |

## Conventions used in these docs

- File paths are relative to the repository root, e.g. `src/lib/diagram/store.ts`.
- "The store" means the Zustand diagram store, `useDiagramStore`, unless it says "file store".
- **Why** paragraphs explain a decision; **Trap** paragraphs describe a mistake the code is written to avoid.
