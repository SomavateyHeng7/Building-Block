// The browser tests, as TesterArmy runs them: plain-language steps an AI agent follows in a real browser, with
// `javascript` steps where it can't see or do something itself (native file pickers, downloads, CSS classes,
// browser storage). `pnpm testerarmy:sync` creates or updates them in TesterArmy; see docs/15-testing-and-qa.md.
const act = (title) => ({ type: "act", title });
const assert = (title) => ({ type: "assert", title });
const js = (title, code) => ({ type: "javascript", title, code });

const consent = act(
  "Open the /diagrams page. If a 'Before you start' privacy dialog appears, tick its checkbox and click 'Accept and continue'.",
);
const openTemplate = (name) => [
  consent,
  act(`On the 'Start a diagram' page, click the '${name}' template.`),
  assert("The editor opens (URL ends in /editor) and the diagram's components are shown on the canvas."),
];
const ok = "return { success: true };";
const fail = (reason) => `return { success: false, reason: ${reason} };`;

// Save and export end in a download the agent can't inspect, so record them instead of downloading.
const captureDownloads = js(
  "Hide the native file pickers and record downloads",
  `for (const name of ["showSaveFilePicker", "showOpenFilePicker"]) Object.defineProperty(window, name, { value: undefined, configurable: true });
window.__downloads = [];
const click = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () {
  if (this.download && this.href.startsWith("blob:")) { window.__downloads.push({ name: this.download, href: this.href }); return; }
  return click.call(this);
};
${ok}`,
);
const expectDownload = (title, check, extra = "") =>
  js(
    title,
    `return (async () => {
  const last = (window.__downloads || []).at(-1);
  if (!last) ${fail('"nothing was downloaded"')}
  if (!(${check})) ${fail('"downloaded " + last.name')}
  ${extra}
  ${ok}
})();`,
  );
const pngIsAPicture = `const size = (await (await fetch(last.href)).blob()).size;
  if (size <= 10000) ${fail('"the PNG is only " + size + " bytes"')}`;
// The native open picker can't be driven, so hand the app a file through a stand-in picker.
const stubOpenPicker = (title, text, name) =>
  js(
    title,
    `const file = new File([${text}], ${JSON.stringify(name)}, { type: "application/json" });
const handle = { kind: "file", name: file.name, getFile: async () => file };
Object.defineProperty(window, "showOpenFilePicker", { value: async () => [handle], configurable: true });
Object.defineProperty(window, "showSaveFilePicker", { value: async () => { throw new DOMException("cancelled", "AbortError"); }, configurable: true });
${ok}`,
  );
const exportPngOnly = [
  act("Click 'Export'."),
  act(
    "In the Export dialog, tick 'PNG image' and untick every other format (SVG image, PDF, Component list, Connection list, Diagram file).",
  ),
  act("Click the 'Download' button in the Export dialog."),
];
const countOf = (selector) => `document.querySelectorAll(${JSON.stringify(selector)}).length`;
const remember = (key, selector) =>
  js(`Remember how many ${key} there are`, `sessionStorage.setItem("ta:${key}", String(${countOf(selector)}));\n${ok}`);
const expectCount = (key, selector, delta) =>
  js(
    `There are ${delta === 0 ? "as many" : delta > 0 ? `${delta} more` : `${-delta} fewer`} ${key} than remembered`,
    `const want = Number(sessionStorage.getItem("ta:${key}")) + ${delta};
const have = ${countOf(selector)};
if (have !== want) ${fail("`expected ${want} " + key + ", found ${have}`")}
${ok}`,
  );
const noSidewaysScroll = js(
  "The page doesn't scroll sideways",
  `const { scrollWidth, clientWidth } = document.documentElement;
if (scrollWidth > clientWidth) ${fail("`page is ${scrollWidth}px wide on a ${clientWidth}px screen`")}
${ok}`,
);
const recoveryCopy = (want) =>
  js(
    want ? "A recovery copy is kept in the browser" : "No recovery copy is kept in the browser",
    `const has = !!localStorage.getItem("bb:recovery:copy");
if (has !== ${want}) ${fail(`"recovery copy ${want ? "missing" : "still there"}"`)}
${ok}`,
  );
const startBlankWithContainer = [
  act("Click 'New blank diagram'."),
  act("If an 'Edit' button is shown in the toolbar, click it to switch to editing."),
  act("On the empty canvas, click the 'Container' button."),
  assert("The canvas shows exactly one container."),
];

const desktop = { viewport: "desktop" };
const tablet = { viewport: "tablet" };
const mobile = { viewport: "mobile" };

const DRAWIO = `<mxfile><diagram name="Platform"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="lane" value="Core Systems" style="swimlane;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="320" height="200" as="geometry"/></mxCell><mxCell id="a" value="Orders" style="fillColor=#dae8fc;" vertex="1" parent="lane"><mxGeometry x="20" y="40" width="120" height="60" as="geometry"/></mxCell><mxCell id="b" value="Payments" style="fillColor=#d5e8d4;" vertex="1" parent="1"><mxGeometry x="500" y="80" width="120" height="60" as="geometry"/></mxCell><mxCell id="e" value="Charge" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`;
const RESPONSIVE_PAGES = ["/", "/diagrams", "/templates", "/privacy", "/contact", "/this-page-does-not-exist"];

export const tests = [
  // consent.spec.ts
  {
    title: "Privacy notice comes first; Not now goes home",
    settings: desktop,
    steps: [
      act("Open the /diagrams page."),
      assert("A 'Before you start' dialog is shown and its 'Accept and continue' button is disabled."),
      act("Click 'Not now'."),
      assert("The home page is shown (the URL path is /)."),
    ],
  },
  {
    title: "Accepting the privacy notice lets people in and is remembered",
    settings: desktop,
    steps: [
      act("Open the /diagrams page."),
      act("In the 'Before you start' dialog, tick the checkbox and click 'Accept and continue'."),
      assert("The dialog is gone and the 'Start a diagram' heading is shown."),
      act("Reload the page."),
      assert("The 'Start a diagram' heading is shown and the 'Before you start' dialog doesn't come back."),
    ],
  },
  // compare.spec.ts
  {
    title: "Compare tabs lists what changed and jumps to it",
    settings: desktop,
    steps: [
      ...openTemplate("Current vs target state"),
      captureDownloads,
      act("Click 'Compare tabs' in the toolbar."),
      assert("The Compare tabs dialog compares From 'Current' To 'Target', and its list mentions 'added'."),
      assert("The list has a Removed entry for 'Legacy CRM'."),
      assert(
        "The Changed entry for 'Customer Website' says 'Category: Product Components → Enhancement Components'.",
      ),
      act("Click 'Download change list'."),
      expectDownload(
        "The change list downloads as current-vs-target-state-current-vs-target.csv",
        'last.name === "current-vs-target-state-current-vs-target.csv"',
      ),
      act("Click the Added entry for 'Mobile App'."),
      assert("The dialog closes, the 'Target' tab is selected, and the 'Mobile App' component is selected on the canvas."),
    ],
  },
  {
    title: "Templates page lists every template",
    settings: desktop,
    steps: [
      consent,
      act("Open the /templates page."),
      assert(
        "These templates are all listed: L0 Architecture, Three-tier web application, Event-driven microservices, Current vs target state.",
      ),
    ],
  },
  {
    title: "Compare marks changes on the canvas, on both tabs, until stopped",
    settings: desktop,
    steps: [
      ...openTemplate("Current vs target state"),
      act("Click 'Compare tabs', then 'Show on canvas' in the dialog."),
      assert("The 'Target' tab is selected."),
      js(
        "Mobile App is marked added and Customer Website changed",
        `const text = (cls) => [...document.querySelectorAll(".react-flow__node." + cls)].map((node) => node.textContent);
if (!text("bb-change-added").some((t) => t.includes("Mobile App"))) ${fail('"Mobile App not marked added"')}
if (text("bb-change-changed").filter((t) => t.includes("Customer Website")).length !== 1) ${fail('"Customer Website not marked changed"')}
${ok}`,
      ),
      act("Click the 'Current' tab."),
      js(
        "Legacy CRM is marked removed",
        `const removed = [...document.querySelectorAll(".react-flow__node.bb-change-removed")].filter((node) => node.textContent.includes("Legacy CRM"));
if (removed.length !== 1) ${fail('"Legacy CRM not marked removed"')}
${ok}`,
      ),
      act("Click 'Stop showing'."),
      js(
        "Nothing is marked any more",
        `if (${countOf(".react-flow__node.bb-change")}) ${fail('"changes still marked"')}\n${ok}`,
      ),
    ],
  },
  // connections.spec.ts
  {
    title: "A connection's route can be changed, its line dragged clear, then put back",
    settings: desktop,
    steps: [
      ...openTemplate("L0 Architecture"),
      act(
        "Click components on the canvas one at a time until the side panel lists a connection, then click that connection in the panel.",
      ),
      assert("The side panel shows the 'Connection' heading."),
      act("In the panel, choose the 'Curved' route."),
      assert("'Curved' is the selected route."),
      act("On the canvas, drag the 'Move the line' dot on the selected connection about 80 pixels down."),
      assert("A 'Reset line' button appears in the panel."),
      act("Click 'Reset line'."),
      assert("The 'Reset line' button is gone."),
    ],
  },
  {
    title: "A component connects to a container, the arrow's end moves, and the arrow is deleted",
    settings: desktop,
    steps: [
      ...openTemplate("L0 Architecture"),
      remember("connections", ".react-flow__edge"),
      act(
        "Hover the first component on the canvas, then drag from its bottom connection dot to the top connection dot of the last container.",
      ),
      expectCount("connections", ".react-flow__edge", 1),
      assert("The side panel shows a 'Connection' from that component to that container ('<component> → <container>')."),
      act("Drag the selected arrow's head (its end at the container) onto the top connection dot of a different component."),
      assert("The panel now shows the connection going to that other component."),
      expectCount("connections", ".react-flow__edge", 1),
      act("Press the Delete key."),
      expectCount("connections", ".react-flow__edge", 0),
      assert("The panel no longer shows a 'Connection' heading."),
    ],
  },
  // details-panel.spec.ts
  {
    title: "A component connects to a container from the panel's picker",
    settings: desktop,
    steps: [
      ...openTemplate("L0 Architecture"),
      remember("connections", ".react-flow__edge"),
      act("Click the first component on the canvas."),
      act("In the side panel's 'Connect to another component or container' dropdown, choose the name of the last container on the canvas."),
      expectCount("connections", ".react-flow__edge", 1),
    ],
  },
  {
    title: "With the details panel in a drawer, Esc in a field keeps it open and the note badge reopens it",
    settings: tablet,
    steps: [
      ...openTemplate("L0 Architecture"),
      act("If an 'Edit' button is shown in the toolbar, click it to switch to editing."),
      act("Click the first component on the canvas, then click the 'Details' button."),
      assert("The details drawer is open."),
      act("Type 'Risk: vendor lock-in' in the drawer's Notes field, then press Escape while still in the field."),
      assert("The details drawer is still open."),
      act("Click 'Close panel'."),
      assert("The details drawer is closed."),
      act("Click the first 'Edit notes' badge on the canvas."),
      assert("The details drawer is open again with the cursor in the Notes field."),
    ],
  },
  // files.spec.ts
  {
    title: "Draw, save as a file, and open it again",
    settings: desktop,
    steps: [
      consent,
      captureDownloads,
      ...startBlankWithContainer,
      act("Press Ctrl+S."),
      expectDownload(
        "The diagram saves as untitled-diagram.json",
        'last.name === "untitled-diagram.json"',
        `sessionStorage.setItem("ta:saved", await (await fetch(last.href)).text());`,
      ),
      act("Open the /diagrams page."),
      stubOpenPicker("Offer the saved file to the open picker", 'sessionStorage.getItem("ta:saved")', "saved.json"),
      act("Click 'Open a diagram file'."),
      assert("The editor opens (URL ends in /editor) with exactly one container on the canvas."),
    ],
  },
  {
    title: "A broken diagram file is refused with a message",
    settings: desktop,
    steps: [
      consent,
      stubOpenPicker("Offer a broken file to the open picker", '"not json"', "notes.json"),
      act("Click 'Open a diagram file'."),
      assert("An alert says 'Couldn't open \"notes.json\"', and the page stays on /diagrams."),
    ],
  },
  {
    title: "Export a PNG of the template",
    settings: desktop,
    steps: [
      ...openTemplate("L0 Architecture"),
      captureDownloads,
      ...exportPngOnly,
      expectDownload("A real PNG picture downloads", "last.name.endsWith('.png')", pngIsAPicture),
    ],
  },
  // grouping.spec.ts
  {
    title: "Deleting a container asks about its components, and they can be grouped again",
    settings: desktop,
    steps: [
      ...openTemplate("L0 Architecture"),
      remember("containers", ".react-flow__node-container"),
      remember("components", ".react-flow__node-block"),
      act("Click the header of the first container on the canvas, then press Delete."),
      assert("A confirmation says the container holds some components."),
      act("Click 'Keep components'."),
      expectCount("containers", ".react-flow__node-container", -1),
      expectCount("components", ".react-flow__node-block", 0),
      act("Click the first component on the canvas, then press Ctrl+G."),
      expectCount("containers", ".react-flow__node-container", 0),
      assert("The side panel shows the 'Container' heading."),
      act("Press Delete, then click 'Delete everything' in the confirmation."),
      expectCount("containers", ".react-flow__node-container", -1),
      expectCount("components", ".react-flow__node-block", -1),
    ],
  },
  // import.spec.ts
  {
    title: "A pasted Mermaid sequence diagram opens as a new diagram",
    settings: desktop,
    steps: [
      consent,
      act("Click 'Import from draw.io or Mermaid'."),
      act(
        "Paste this text into the dialog's text box, keeping the line breaks, then click 'Open':\nsequenceDiagram\n  title Login\n  actor User\n  User->>App: Sign in\n  App-->>User: Welcome",
      ),
      assert("The editor opens with a message saying 'Imported \"Login\"'."),
      assert("The sequence sheet shows a 'User' participant drawn as a person."),
    ],
  },
  {
    title: "A draw.io diagram is added as a tab, with its shapes, container, colours and arrow",
    settings: desktop,
    steps: [
      ...openTemplate("L0 Architecture"),
      remember("tabs", "[role=tab]"),
      act("Open the 'File' menu and choose 'Import draw.io or Mermaid…'."),
      js(
        "Paste the draw.io diagram into the import box",
        `const box = document.querySelector("[role=dialog] textarea");
if (!box) ${fail('"no import text box"')}
Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, ${JSON.stringify(DRAWIO)});
box.dispatchEvent(new Event("input", { bubbles: true }));
${ok}`,
      ),
      act("Click 'Open' in the import dialog."),
      expectCount("tabs", "[role=tab]", 1),
      assert("A new 'Platform' tab is selected."),
      js(
        "The tab has one container, two components and one arrow",
        `const found = [${countOf(".react-flow__node-container")}, ${countOf(".react-flow__node-block")}, ${countOf(".react-flow__edge")}];
if (found.join() !== "1,2,1") ${fail("`containers, components, arrows: ${found}`")}
${ok}`,
      ),
      assert("The legend has an entry named 'Imported #dae8fc'."),
      act("Press Ctrl+Z."),
      expectCount("tabs", "[role=tab]", 0),
    ],
  },
  {
    title: "A Mermaid flowchart gets a clear message pointing to draw.io",
    settings: desktop,
    steps: [
      consent,
      act("Click 'Import from draw.io or Mermaid'."),
      act("Paste this text into the dialog's text box, keeping the line break, then click 'Open':\nflowchart LR\n  A --> B"),
      assert("The dialog shows an error telling you to import a draw.io file instead."),
    ],
  },
  // legend-order.spec.ts
  {
    title: "Legend entries reorder by dragging or arrow keys, and a removed one's items move to another",
    settings: desktop,
    steps: [
      ...openTemplate("L0 Architecture"),
      act("Note the order of the entries in the Legend panel."),
      act("Drag the first legend entry's move handle down below the third entry."),
      assert("The legend order is now: the old 2nd, the old 3rd, the old 1st, then the rest unchanged."),
      act("With the moved entry's handle focused, press the Up arrow key twice."),
      assert("The legend is back in its original order, and the handle still has keyboard focus."),
      act(
        "Hover a legend entry that is in use (shows 'Used by'), click its Remove button, choose a different entry to move its items to, and click 'Move and remove'.",
      ),
      assert("That entry is gone from the legend and the other entries keep their order."),
      js(
        "No component is left without a legend entry (dashed)",
        `if (${countOf(".react-flow__node-block[style*='dashed']")}) ${fail('"some components are dashed"')}\n${ok}`,
      ),
    ],
  },
  // legend.spec.ts
  {
    title: "A legend entry is renamed by double-clicking its name, and Esc cancels",
    settings: desktop,
    steps: [
      ...openTemplate("L0 Architecture"),
      act("Click the first entry name in the Legend panel once."),
      assert("No rename text box opens."),
      act("Double-click that entry name, type 'Retiring' in the 'Legend entry name' box, and press Escape."),
      assert("The entry keeps its original name."),
      act("Double-click that entry name again, type 'Retiring', and press Enter."),
      assert("The rename box closes and the legend shows an entry named 'Retiring'."),
      act("Click the Legend panel's 'Add' button."),
      assert("A new entry appears with the cursor in its name box, ready to type."),
    ],
  },
  // recovery.spec.ts
  {
    title: "Recovery copy is off by default: nothing is kept",
    settings: desktop,
    steps: [
      consent,
      assert("The 'Keep a recovery copy' checkbox is not ticked."),
      captureDownloads,
      ...startBlankWithContainer,
      act("Wait about one second."),
      recoveryCopy(false),
      act("Open the /diagrams page, leaving without saving if the browser asks."),
      assert("No 'Unsaved changes' card is shown."),
    ],
  },
  {
    title: "With recovery on, unsaved changes survive leaving, and saving removes the copy",
    settings: desktop,
    steps: [
      consent,
      act("Tick 'Keep a recovery copy'."),
      ...startBlankWithContainer,
      act("Wait about two seconds."),
      recoveryCopy(true),
      act("Open the /diagrams page, leaving without saving if the browser asks."),
      assert("An 'Unsaved changes' card shows 'Untitled Diagram'."),
      act("Click 'Recover' on that card."),
      assert("The editor opens with exactly one container on the canvas."),
      captureDownloads,
      act("Press Ctrl+S, then wait about one second."),
      recoveryCopy(false),
    ],
  },
  {
    title: "Discarding a recovery copy on the start page deletes it",
    settings: desktop,
    steps: [
      consent,
      act("Tick 'Keep a recovery copy'."),
      ...startBlankWithContainer,
      act("Wait about two seconds."),
      recoveryCopy(true),
      act("Open the /diagrams page, leaving without saving if the browser asks."),
      act("On the 'Unsaved changes' card, click 'Discard', then confirm with 'Delete the changes?'."),
      assert("The 'Unsaved changes' card is gone."),
      recoveryCopy(false),
    ],
  },
  {
    title: "Turning recovery off from the File menu deletes the copy",
    settings: desktop,
    steps: [
      consent,
      act("Tick 'Keep a recovery copy'."),
      ...startBlankWithContainer,
      act("Wait about two seconds."),
      recoveryCopy(true),
      act("Open the 'File' menu and click 'Keep a recovery copy' to turn it off, then wait about one second."),
      recoveryCopy(false),
    ],
  },
  // responsive.spec.ts: every page, on each screen size the specs ran on.
  ...Object.entries({ desktop, tablet, mobile }).flatMap(([name, settings]) => [
    {
      title: `Every page fits a ${name} screen`,
      settings,
      steps: [consent, ...RESPONSIVE_PAGES.flatMap((path) => [act(`Open the ${path} page.`), noSidewaysScroll])],
    },
    {
      title: `The editor and its File menu fit a ${name} screen`,
      settings,
      steps: [
        ...openTemplate("L0 Architecture"),
        noSidewaysScroll,
        js(
          "Tabs stay in their 36px row",
          `const tab = document.querySelector("[role=tab]");
if (!tab) ${fail('"no tab"')}
const height = tab.getBoundingClientRect().height;
if (height > 36) ${fail("`tab is ${height}px tall`")}
${ok}`,
        ),
        act("Click the 'File' button."),
        js(
          "The File menu is inside the screen",
          `const menu = document.querySelector("[role=menu]");
if (!menu) ${fail('"File menu not open"')}
const { left, right } = menu.getBoundingClientRect();
if (left < 0 || right > window.innerWidth) ${fail("`menu spans ${left}–${right} on a ${window.innerWidth}px screen`")}
${ok}`,
        ),
        noSidewaysScroll,
      ],
    },
  ]),
  // search.spec.ts
  {
    title: "Search finds a component on another tab and goes to it",
    settings: desktop,
    steps: [
      ...openTemplate("Current vs target state"),
      assert("The 'Current' tab is selected."),
      act("Click 'Find in diagram', type 'mobile' in the search box."),
      assert("The first result is 'Mobile App'."),
      act("Press Enter."),
      assert("The search dialog closes, the 'Target' tab is selected, and 'Mobile App' is selected on the canvas."),
    ],
  },
  {
    title: "Ctrl+F opens search and says when nothing matches",
    settings: desktop,
    steps: [
      ...openTemplate("Current vs target state"),
      act("Click an empty part of the canvas, then press Ctrl+F."),
      act("Type 'zzzz' in the 'Find in diagram' search box."),
      assert("The dialog says 'Nothing matches'."),
      act("Press Escape."),
      assert("The search dialog is closed."),
    ],
  },
  // sequence.spec.ts
  {
    title: "The sequence template draws its flow, and a message is drawn between lifelines",
    settings: desktop,
    steps: [
      ...openTemplate("Sequence diagram"),
      assert("The sequence sheet shows a 'Customer' participant drawn as a person, and message 1 'Place order'."),
      remember("messages", ".bb-sequence-sheet [data-step]"),
      act(
        "Drag horizontally from the second participant's lifeline (just below its header, above the first message) to the fourth participant's lifeline.",
      ),
      expectCount("messages", ".bb-sequence-sheet [data-step]", 1),
      assert("The side panel shows the 'Message' heading with the cursor in the 'What's sent' box."),
      act("Type 'Refund' in 'What's sent', then choose 'Async'."),
      assert("The sheet shows a 'Refund' message as the first message."),
      act("Click the 'Refund' message on the sheet, then press the Down arrow key."),
      assert("'Refund' is now the second message."),
      act("Press Delete."),
      expectCount("messages", ".bb-sequence-sheet [data-step]", 0),
      act("Press Ctrl+Z."),
      expectCount("messages", ".bb-sequence-sheet [data-step]", 1),
    ],
  },
  {
    title: "A sequence tab is added beside an architecture tab and filled from the palette",
    settings: desktop,
    steps: [
      ...openTemplate("L0 Architecture"),
      act("Click 'Add a sequence tab'."),
      assert("A selected tab named 'Sequence 2' (sequence diagram) asks 'Who takes part in this flow?'."),
      act("In the left palette, click 'Actor (person)', then type 'Architect' in the side panel's Name box."),
      act("In the left palette, click 'Microservices'."),
      assert("The sheet shows an 'Architect' participant drawn as a person and a 'Microservices' participant."),
      act("Click the top-left corner of the sequence sheet, then click 'Add message' in the side panel."),
      assert("The sheet has exactly one message."),
      act("Press Escape, then press the 'c' key."),
      act("Click the first tab."),
      assert("The architecture canvas with its components is shown again."),
    ],
  },
  {
    title: "A sequence tab exports as a picture",
    settings: desktop,
    steps: [
      ...openTemplate("Sequence diagram"),
      captureDownloads,
      ...exportPngOnly,
      expectDownload("checkout-flow.png downloads and is a real picture", 'last.name === "checkout-flow.png"', pngIsAPicture),
    ],
  },
  // view-mode.spec.ts
  {
    title: "Phone screens open diagrams in view mode: tap for details, nothing moves",
    settings: mobile,
    steps: [
      ...openTemplate("L0 Architecture"),
      assert("An 'Edit' button is shown, and there are no 'Add' or 'Undo' buttons."),
      js(
        "Remember where Customer Portal sits next to Mobile App",
        `const box = (name) => [...document.querySelectorAll(".react-flow__node-block")].find((node) => node.textContent.includes(name))?.getBoundingClientRect();
const [a, b] = [box("Customer Portal"), box("Mobile App")];
if (!a || !b) ${fail('"components not found"')}
sessionStorage.setItem("ta:offset", JSON.stringify([Math.round(a.x - b.x), Math.round(a.y - b.y)]));
${ok}`,
      ),
      act("Drag the 'Customer Portal' component about 80 pixels down and to the right."),
      js(
        "Customer Portal kept its place next to Mobile App (the view panned instead)",
        `const box = (name) => [...document.querySelectorAll(".react-flow__node-block")].find((node) => node.textContent.includes(name)).getBoundingClientRect();
const [a, b] = [box("Customer Portal"), box("Mobile App")];
const now = JSON.stringify([Math.round(a.x - b.x), Math.round(a.y - b.y)]);
if (now !== sessionStorage.getItem("ta:offset")) ${fail('"the component moved"')}
${ok}`,
      ),
      act("Tap the 'Customer Portal' component."),
      assert("A Details sheet shows the 'Customer Portal' heading and a Connections section."),
      act("Tap 'Close details'."),
      assert("The Details sheet is closed."),
      act("Tap the 'Legend' button."),
      assert("The Details sheet shows the 'Legend' heading."),
      act("Tap 'Edit'."),
      assert("The 'Add' and 'Undo' buttons are shown."),
    ],
  },
  {
    title: "Screens 768px and wider open diagrams in edit mode",
    settings: tablet,
    steps: [
      ...openTemplate("L0 Architecture"),
      assert("An 'Undo' button is shown and there is no 'Edit' button."),
    ],
  },
  // offline.spec.ts
  {
    title: "The app can be installed: manifest with icons and diagram file handling",
    settings: desktop,
    steps: [
      act("Open the home page."),
      js(
        "The web app manifest is complete and its icons load",
        `return (async () => {
  const response = await fetch("/manifest.webmanifest");
  if (!response.ok) ${fail('"manifest: " + response.status')}
  const manifest = await response.json();
  if (manifest.start_url !== "/diagrams") ${fail('"start_url is " + manifest.start_url')}
  if (manifest.display !== "standalone") ${fail('"display is " + manifest.display')}
  const sizes = manifest.icons.map((icon) => icon.sizes);
  if (!sizes.includes("192x192") || !sizes.includes("512x512")) ${fail('"icon sizes: " + sizes')}
  if (!manifest.file_handlers?.[0]?.accept?.["application/json"]?.includes(".json")) ${fail('"no .json file handler"')}
  for (const icon of manifest.icons) if (!(await fetch(icon.src)).ok) ${fail('"icon missing: " + icon.src')}
  ${ok}
})();`,
      ),
    ],
  },
  {
    title: "After one visit, the app's pages are cached for offline use",
    settings: desktop,
    steps: [
      act("Open the home page and wait about five seconds."),
      js(
        "The service worker controls the page and has cached the start page, the editor and the other pages",
        `return (async () => {
  await navigator.serviceWorker.ready;
  for (let i = 0; i < 20 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 500));
  if (!navigator.serviceWorker.controller) ${fail('"no service worker controls the page"')}
  for (const path of ["/diagrams", "/editor", "/contact"]) if (!(await caches.match(path))) ${fail('"not cached: " + path')}
  ${ok}
})();`,
      ),
    ],
  },
  // Added with multi-word search, the tab actions group, linked participants and the contrast fix.
  {
    title: "Search with several words finds what has them all, and highlights them",
    settings: desktop,
    steps: [
      ...openTemplate("Current vs target state"),
      act("Click 'Find in diagram' and type 'app mobile' (the words in the other order)."),
      assert("The first result is 'Mobile App', with the words 'Mobile' and 'App' highlighted."),
      js(
        "The matched words are marked in the results",
        `const marks = [...document.querySelectorAll("[role=dialog] [role=option] mark")].map((mark) => mark.textContent.toLowerCase());
if (!marks.includes("mobile") || !marks.includes("app")) ${fail('"marked: " + marks.join(", ")')}
${ok}`,
      ),
      act("Replace the search text with 'zzzz qqqq'."),
      assert("The dialog says nothing matches."),
    ],
  },
  {
    title: "The open tab is renamed, duplicated and deleted from the tab actions",
    settings: desktop,
    steps: [
      ...openTemplate("L0 Architecture"),
      remember("tabs", "[role=tab]"),
      act("Click the 'Rename tab' button next to the tabs, type 'Platform' as the tab name and press Enter."),
      assert("The open tab is now called 'Platform'."),
      act("Click the 'Duplicate tab' button."),
      expectCount("tabs", "[role=tab]", 1),
      assert("A selected tab named 'Platform copy' is open."),
      act("Click the 'Delete tab' button, then click 'Delete?' to confirm."),
      expectCount("tabs", "[role=tab]", 0),
      js(
        "The tab list holds only tabs; the actions are in a group after it",
        `const list = document.querySelector("[role=tablist]");
const strays = [...list.querySelectorAll("button, input")].filter((element) => element.getAttribute("role") !== "tab");
if (strays.length) ${fail('"tab list also holds: " + strays.map((element) => element.getAttribute("aria-label") || element.textContent).join(", ")')}
if (!document.querySelector("[role=group][aria-label='Tab actions']")) ${fail('"no Tab actions group"')}
${ok}`,
      ),
    ],
  },
  {
    title: "A sequence participant picked from the architecture follows its component's name",
    settings: desktop,
    steps: [
      ...openTemplate("L0 Architecture"),
      act("Click 'Add a sequence tab'."),
      act("In the left panel, use 'Add a component from your architecture' to add 'Customer Portal'."),
      assert("The sequence sheet shows a 'Customer Portal' participant, and the side panel's Name field can't be edited."),
      act("Click the first tab, click the 'Customer Portal' component, and change its Label to 'Web Portal'."),
      act("Click the sequence tab (the last tab)."),
      assert("The participant is now called 'Web Portal'."),
    ],
  },
  {
    title: "Text on every component colour has enough contrast",
    settings: desktop,
    steps: [
      ...openTemplate("L0 Architecture"),
      js(
        "Every component's text is at least 4.5:1 against its colour (WCAG AA)",
        `const rgb = (value) => value.match(/[\\d.]+/g).slice(0, 3).map(Number);
const lum = ([r, g, b]) => {
  const [R, G, B] = [r, g, b].map((v) => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
const low = [];
for (const node of document.querySelectorAll(".react-flow__node-block")) {
  const box = [node, ...node.querySelectorAll("*")].find((el) => getComputedStyle(el).backgroundColor !== "rgba(0, 0, 0, 0)");
  const text = [...node.querySelectorAll("span")].find((el) => el.textContent.trim());
  if (!box || !text) continue;
  const [a, b] = [lum(rgb(getComputedStyle(box).backgroundColor)), lum(rgb(getComputedStyle(text).color))].sort((x, y) => y - x);
  const ratio = (a + 0.05) / (b + 0.05);
  if (ratio < 4.5) low.push(text.textContent.trim() + " " + ratio.toFixed(2));
}
if (low.length) ${fail('"low contrast: " + low.join("; ")')}
${ok}`,
      ),
    ],
  },
  {
    title: "The pricing page shows Free and the plans to come",
    settings: desktop,
    steps: [
      act("Open the home page and click 'Pricing' in the header."),
      assert("The Pricing page shows three plans: Free, Pro and Team."),
      assert("Free has a 'Start drawing' button; Pro and Team are marked 'Coming soon' with 'Price to be announced'."),
      assert("The page says everything Building Block does today is free and stays free."),
      act("Click 'Start drawing' on the Free plan."),
      assert("The start page opens (the URL ends in /diagrams)."),
    ],
  },
  {
    title: "A sequence tab is edited as Mermaid code",
    settings: desktop,
    steps: [
      ...openTemplate("Sequence diagram"),
      act("Click 'Mermaid code' at the top right of the sheet."),
      assert("A Mermaid code box opens beside the sheet, starting with 'sequenceDiagram' and listing the participants."),
      act("At the end of the code, add a new line: Customer->>Customer: Celebrate"),
      act("Click 'Apply'."),
      assert("The sheet now ends with a 'Celebrate' message from Customer to itself."),
      act("Replace all the code with: flowchart LR (then a new line) A --> B, and click 'Apply'."),
      assert("An error under the code says it's a flowchart, and the sheet hasn't changed."),
      act("Click 'Undo edits'."),
      assert("The code starts with 'sequenceDiagram' again."),
    ],
  },
];

// TesterArmy takes 1 to 30 steps a test.
for (const test of tests) if (test.steps.length > 30) throw new Error(`${test.title} has ${test.steps.length} steps`);
