# 18. File reference

Every file in the repository and what it is for. Details are in the linked pages.

## Root

| File | Purpose |
| --- | --- |
| `README.md` | User-facing overview: features, where diagrams live, devices, development commands, form settings |
| `AGENTS.md` / `CLAUDE.md` | Notes for AI coding assistants. `AGENTS.md` is written by `next dev`: Next.js 16 differs from older docs; read `node_modules/next/dist/docs/` first |
| `package.json` | Scripts (`dev`, `build`, `start`, `lint`, `test`, `perf`, `testerarmy:sync`, `test:browser`), dependencies, and pnpm overrides and peer rules; pnpm 9 |
| `pnpm-lock.yaml` | Locked dependency versions |
| `next.config.ts` | Security headers, `poweredByHeader: false` ([security](14-security.md#http-headers)) |
| `tsconfig.json` | Strict TypeScript; `@/*` → `src/*` |
| `eslint.config.mjs` | Next.js core-web-vitals + TypeScript lint rules |
| `postcss.config.mjs` | Tailwind 4 via PostCSS |
| `vitest.config.mts` | `@` alias; tests in `tests/**/*.test.ts`; Node environment |
| `vitest.perf.config.mts` | `pnpm perf`: the performance baselines in `tests/perf/`, one file at a time |
| `.gitignore` | Ignores builds, `node_modules`, `.env*`, `*.tsbuildinfo` |
| `.github/workflows/ci.yml` | On every push to main and pull request: lint, type check, unit tests |
| `.github/workflows/testerarmy.yml` | Browser tests in TesterArmy against each successful deployment, once set up ([testing](15-testing-and-qa.md#browser-tests-testerarmy)) |
| `docs/` | This documentation |

## `src/app/` — routes ([routing](03-routing.md))

| File | Purpose |
| --- | --- |
| `layout.tsx` | Root layout: fonts, metadata, viewport (safe areas, theme colour), `ThemeProvider`, `ToastViewport`, `ConsentGate` |
| `globals.css` | Tailwind import, theme variables, dark variant, safe-area utilities, touch sizing, connection-handle styles, notes tooltip and toast animations, reduced motion |
| `page.tsx` | Landing page ([public pages](13-public-pages.md#landing-page--srcapppagetsx)) |
| `diagrams/page.tsx` | Start page: new, open, drop, templates, legacy leftovers |
| `templates/page.tsx` | All templates with previews |
| `editor/page.tsx` | Renders `EditorApp` |
| `editor/error.tsx` | Editor crash page: download JSON, undo and retry |
| `error.tsx` | Crash page for other routes |
| `not-found.tsx` | 404 page |
| `privacy/page.tsx` | Privacy notice and acceptance box |
| `privacy/WithdrawConsent.tsx` | Shows when consent was given; withdraw button |
| `contact/page.tsx` | Contact page: self-help cards, the address to email, donation section |
| `pricing/page.tsx` | Plans page: Free and coming-soon plans, Notify me, Subscribe once a plan is live |
| `maintenance/page.tsx` | Maintenance page (dynamic) |
| `maintenance/MaintenanceStatus.tsx` | Expected end time, Try again, 30-second check |
| `favicon.ico`, `icon.svg`, `apple-icon.png` | Site icons (Next.js file conventions) |

## `src/proxy.ts`

Maintenance mode for every page request ([routing](03-routing.md#4-the-proxy-maintenance-mode--srcproxyts)).

## `src/components/`

| File | Purpose |
| --- | --- |
| `ConsentGate.tsx` | Privacy-notice acceptance dialog on app pages ([consent](11-privacy-consent-and-forms.md#the-consent-gate)) |
| `Analytics.tsx` | Cloudflare Web Analytics beacon, with a token, in production, unless the browser opts out ([operations](16-operations.md#monitoring-visits)) |
| `ToastViewport.tsx` | Renders toasts; per-toast timers that pause ([notifications](12-notifications.md)) |
| `TemplatePreview.tsx` | SVG preview of a template's first tab |
| `Logo.tsx` | The brand mark (`LogoMark`) |
| `theme-provider.tsx` | Client wrapper around `next-themes`' provider (server layouts can't import it directly) |
| `theme-toggle.tsx` | Light/Dark toggle; `useMounted()` |
| `landing/HeroDiagram.tsx` | Static example diagram on the landing page |
| `landing/Footer.tsx` | Site footer |
| `landing/CurrentYear.tsx` | The year, rendered in the browser |
| `landing/WaitlistForm.tsx` | Waitlist form with consent |

## `src/components/editor/` ([editor UI](07-editor-ui.md))

| File | Purpose |
| --- | --- |
| `EditorApp.tsx` | Editor shell: redirect, shortcuts, autosave, leave warning, layout, drawers, collapsed panels |
| `Toolbar.tsx` | Back, name, save status, File menu, undo/redo, theme, Save, Export (and running exports) |
| `SectionTabs.tsx` | Tabs: switch, rename, duplicate, delete, add, keyboard navigation, Compare tabs button |
| `CompareDialog.tsx` | Compare two tabs: added, removed, changed; jump to an item; change list CSV |
| `DetailBar.tsx` | "Back to tab / component · L2" bar |
| `CompareBar.tsx` | Shown while a comparison is marked on the canvas: colours, the two tabs, Stop showing |
| `compareView.ts` | Which two tabs are compared on the canvas (screen state, not saved) |
| `SearchDialog.tsx` | Find (Ctrl/⌘+F) across tabs and internal designs |
| `canvasFocus.ts` | `goTo`: open a view, select an item and ask the canvas to zoom to it |
| `exportRendering.ts` | `useRenderEverything`: mounts off-screen nodes while an export pictures the canvas |
| `edges/ConnectionEdge.tsx` | A connection line: right-angled, curved or straight, with the dot that bends it |
| `Canvas.tsx` | React Flow canvas: changes → store, drops, connections, empty state |
| `Sidebar.tsx` | Palette: drag or tap to add containers and components |
| `PropertiesPanel.tsx` | Details for the selection (component, container, connection, several, diagram, internal design) |
| `LegendPanel.tsx` | Legend categories: colour, name, usage, add, remove |
| `ColorPicker.tsx` | Named palette popover with custom colours |
| `ExportDialog.tsx` | Export choices and summary ([export](10-export.md#the-export-dialog--exportdialogtsx)) |
| `UnsavedChangesDialog.tsx` | Save / Don't save / Cancel, and the "Saved — Open…" step |
| `useUnsavedGuard.tsx` | Hook that runs an action now or after the dialog |
| `ShortcutsHelp.tsx` | Keyboard shortcuts dialog |
| `DeleteContainerDialog.tsx` / `deletePrompt.ts` | Asks whether to keep a deleted container's components; `requestDelete` is the one way the UI deletes nodes; `ungroup` says when connections to a container were removed |
| `detailsPanel.ts` | `showDetails`: asks EditorApp to show the details panel (drawer or collapsed) and focus a field in it |
| `PanelToggle.tsx` | Collapse/expand button for side panels |
| `Icon.tsx` | Editor icon set |
| `SequenceCanvas.tsx` | A sequence tab: SVG drawing, drag between lifelines to add a message (`.bb-sequence-sheet` is what exports picture) |
| `SequenceCode.tsx` | The left panel on a sequence tab: its Mermaid code, follows the sheet, Apply, Copy, `.mmd` download |
| `SequencePanel.tsx` | Details for a sequence participant, message or note (not shown since sequence tabs dropped the right panel) |
| `sequenceSelection.ts` | What's selected on a sequence tab |
| `ImportDialog.tsx` | Import from a file or pasted text; used by the start page and File menu |
| `nodes/BlockNode.tsx` | A component on the canvas: colour, handles, rename, notes marker, L2 badge |
| `nodes/ContainerNode.tsx` | A container: header placement, outline, resize limits, Fit/Tidy toolbar |

## `src/lib/`

| File | Purpose |
| --- | --- |
| `diagram/types.ts` | The data model ([data model](04-data-model-and-file-format.md)) |
| `diagram/store.ts` | Diagram store, active view, undo, clipboard ([store](05-diagram-store-and-undo.md)) |
| `diagram/file.ts` | File store, open/save/autosave support, dirty tracking, downloads, file names ([files](06-files-saving-and-unsaved-changes.md)) |
| `diagram/validate.ts` | Parsing and repairing files |
| `diagram/factory.ts` | Ids, blank diagrams and tabs, default labels |
| `diagram/defaultLegend.ts` | The default legend |
| `diagram/palette.ts` | Named colours, colour names, next colour, parsing colour codes, readable text colour |
| `diagram/layout.ts` | Nesting, insets, arrange, tidy, fit, nudge, re-parenting ([layout](08-layout-and-containers.md)) |
| `diagram/flowAdapter.ts` | Our nodes/edges ↔ React Flow's; undo keys; connection captions; line geometry (`connectionPath`); change marks |
| `diagram/search.ts` | Finding components, containers, connections and sequence steps across the diagram; highlighting matches |
| `diagram/export.ts` | Rendering pictures, PDF, SVG, CSV rows, export titles ([export](10-export.md)) |
| `diagram/exportPlan.ts` | Which files an export produces |
| `diagram/componentIcons.ts` | The built-in component icons (key, label, SVG path); keys are stored in files |
| `diagram/compare.ts` | Comparing two tabs by name; change counts and the change-list CSV rows |
| `diagram/legacy.ts` | Finds, downloads and removes diagrams left by earlier versions |
| `diagram/sequence.ts` | Sequence diagrams: editing helpers (pure) and `layoutSequence` |
| `diagram/importFile.ts` | Import entry point: picks draw.io or Mermaid, checks the result with `parseDiagram` |
| `diagram/importDrawio.ts` | draw.io (.drawio/.xml, compressed or not) → architecture tabs |
| `diagram/importMermaid.ts` | Mermaid `sequenceDiagram` → a sequence; `ImportError` |
| `diagram/exportMermaid.ts` | A sequence → Mermaid code, and code applied back keeping colours, descriptions and links |
| `diagram/xml.ts` | Small XML reader used by the draw.io import |
| `zip.ts` | Minimal ZIP writer |
| `toast.ts` | Toast store and API |
| `consent.ts` | Privacy-notice acceptance, versioned |
| `levels.ts` | Roadmap levels computed from store actions |
| `maintenance.ts` | Reads maintenance settings; `Retry-After`; upcoming end |
| `plans.ts` | The plans on `/pricing`; `formatPrice`, `canSubscribe`; plan limits (`checkSequenceCodeLines`, not enforced while `LIMITS_ENFORCED` is false) |

## `src/templates/`

| File | Purpose |
| --- | --- |
| `types.ts` | `TemplateDefinition` |
| `index.ts` | `allTemplates`, `templates` (without the hidden ones), `getTemplate(id)` |
| `blank.ts` | Blank canvas |
| `build.ts` | Lays out templates written as data (`CanvasSpec`) and builds diagrams with fresh ids |
| `l0-architecture.ts` | Four-layer L0 example with connections |
| `three-tier.ts` | Three-tier web application |
| `event-driven.ts` | Event-driven microservices, with an internal design (L2) |
| `serverless.ts` | Serverless API on managed services |
| `data-platform.ts` | Data and analytics platform |
| `current-vs-target.ts` | Two tabs, current and target, for Compare tabs (hidden for now) |
| `sequence-build.ts` | Builds a one-tab sequence diagram from participants and steps written as data |
| `sequence.ts` | A checkout flow as a sequence tab |
| `oidc-sign-in.ts` | OpenID Connect sign-in as a sequence tab |
| `cache-aside.ts` | A cache-aside read as a sequence tab |

## `src/types/`

| File | Purpose |
| --- | --- |
| `file-system-access.d.ts` | Types for `showOpenFilePicker`, `showSaveFilePicker` and `getAsFileSystemHandle`, missing from TypeScript's DOM library |

## `tests/`

Unit tests mirroring `src/` ([testing](15-testing-and-qa.md#layout-of-the-test-suite)).

## `testerarmy/`

Browser tests run by TesterArmy ([testing](15-testing-and-qa.md#browser-tests-testerarmy)).

| File | Purpose |
| --- | --- |
| `tests.mjs` | The tests: plain-language steps, with `javascript` steps where the agent can't see or act |
| `sync.mjs` | `pnpm testerarmy:sync`: creates or updates them in a TesterArmy group, matched by title |
