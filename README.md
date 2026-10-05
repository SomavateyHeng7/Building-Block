# Building Block

Browser-based L0 architecture diagrams for solution architects. Build a landscape from containers and
components, colour them with a legend you define, and export for review decks and solution documents.

**No account, no server, no database.** Diagrams are saved in the browser's localStorage and never leave
the device. Use *Export → Diagram file (JSON)* to back up or move a diagram.

## Features

- Containers and components with drag-in nesting, resize, snap-to-grid and a minimap
- A user-defined legend; exports include only the categories used
- Details per component: technology, owner, description, notes
- Align, distribute, match size, fit container, tidy layout
- Several tabs per diagram (e.g. current vs target) with copy/paste between them
- Templates, including your own saved layouts
- Export: PNG, PDF, SVG, component list (CSV), JSON backup; PNG/PDF can cover all tabs
- Keyboard shortcuts (press `?` in the editor)

L1 (interactions) and L2 (component detail) are planned, not built.

## Development

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # unit tests (validation and layout)
pnpm lint
pnpm build
```

Optional: set `NEXT_PUBLIC_WAITLIST_URL` to a form endpoint that accepts a JSON `{ email }` POST to show
the landing-page waitlist form. Leave it unset to keep the app fully offline.

Next.js 16 / React 19 / Tailwind 4 / React Flow / Zustand. See `AGENTS.md` before changing Next.js code.
