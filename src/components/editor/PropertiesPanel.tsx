"use client";

import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { suggestConnectionSides, type ArrangeOp } from "@/lib/diagram/layout";
import { connectionCaption } from "@/lib/diagram/flowAdapter";
import type {
  BlockColorKey,
  ConnectionDirection,
  ConnectionLineStyle,
  ContainerNodeData,
  DiagramEdge,
  ContainerStyle,
  HeaderAlign,
  HeaderPosition,
  LegendEntry,
  NodeDetails,
  OutlineStyle,
} from "@/lib/diagram/types";
import { Icon } from "./Icon";

const DETAIL_FIELDS: {
  key: keyof NodeDetails;
  label: string;
  placeholder: string;
  multiline?: boolean;
  blockOnly?: boolean;
}[] = [
  { key: "technology", label: "Technology", placeholder: "e.g. Java / Spring Boot, Kafka", blockOnly: true },
  { key: "owner", label: "Owner", placeholder: "Team, vendor or contact" },
  { key: "description", label: "Description", placeholder: "What it does and why it's here", multiline: true },
  { key: "notes", label: "Notes", placeholder: "Assumptions, risks, open questions", multiline: true },
];

const ARRANGE_GROUPS: { title: string; ops: { op: ArrangeOp; label: string; icon: string }[] }[] = [
  {
    title: "Align",
    ops: [
      { op: "align-left", label: "Align left edges", icon: "M4 3v18M8 7h12M8 17h7" },
      { op: "align-center", label: "Align horizontal centers", icon: "M12 3v18M6 7h12M8 17h8" },
      { op: "align-right", label: "Align right edges", icon: "M20 3v18M4 7h12M9 17h7" },
      { op: "align-top", label: "Align top edges", icon: "M3 4h18M7 8v12M17 8v7" },
      { op: "align-middle", label: "Align vertical centers", icon: "M3 12h18M7 6v12M17 8v8" },
      { op: "align-bottom", label: "Align bottom edges", icon: "M3 20h18M7 4v12M17 9v7" },
    ],
  },
  {
    title: "Distribute & size",
    ops: [
      { op: "distribute-horizontal", label: "Distribute horizontally (even gaps)", icon: "M4 4v16M20 4v16M10 8v8M14 8v8" },
      { op: "distribute-vertical", label: "Distribute vertically (even gaps)", icon: "M4 4h16M4 20h16M8 10h8M8 14h8" },
      { op: "same-width", label: "Make same width (widest)", icon: "M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3" },
      { op: "same-height", label: "Make same height (tallest)", icon: "M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3" },
    ],
  },
];

const SECTION_TITLE = "text-xs font-semibold uppercase tracking-wide text-zinc-500";
const PANEL = "flex flex-col gap-4 border-b border-zinc-200 p-4 dark:border-zinc-800";
const FIELD_LABEL = "flex flex-col gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300";
const FIELD =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-normal outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900";
const ACTION_BUTTON =
  "rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900";
const DELETE_BUTTON =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950";

const HEADER_POSITIONS: { value: HeaderPosition; label: string; icon: string }[] = [
  { value: "top", label: "Top", icon: "M4 4h16v16H4zM4 9h16" },
  { value: "bottom", label: "Bottom", icon: "M4 4h16v16H4zM4 15h16" },
  { value: "left", label: "Left", icon: "M4 4h16v16H4zM9 4v16" },
  { value: "right", label: "Right", icon: "M4 4h16v16H4zM15 4v16" },
];

const OUTLINE_STYLES: { value: OutlineStyle; label: string; icon: string }[] = [
  { value: "solid", label: "Solid", icon: "M3 12h18" },
  { value: "dashed", label: "Dashed", icon: "M3 12h4M10 12h4M17 12h4" },
];

/** A row of toggle buttons where exactly one is pressed. */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={`flex flex-1 items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium ${
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {option.icon ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d={option.icon} />
              </svg>
            ) : (
              option.label
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Header placement and outline for a container. */
function ContainerStyleControls({
  id,
  data,
  legend,
  onChange,
}: {
  id: string;
  data: ContainerNodeData;
  legend: LegendEntry[];
  onChange: (id: string, patch: ContainerStyle) => void;
}) {
  const headerPosition = data.headerPosition ?? "top";
  const vertical = headerPosition === "left" || headerPosition === "right";
  const alignOptions: { value: HeaderAlign; label: string }[] = vertical
    ? [
        { value: "start", label: "Top" },
        { value: "center", label: "Middle" },
        { value: "end", label: "Bottom" },
      ]
    : [
        { value: "start", label: "Left" },
        { value: "center", label: "Center" },
        { value: "end", label: "Right" },
      ];
  const categoryColor = legend.find((entry) => entry.key === data.colorKey)?.color;
  const outlineColor = data.outlineColor ?? categoryColor ?? "#9ca3af";

  return (
    <>
      <div className={FIELD_LABEL}>
        Header
        <Segmented
          label="Header position"
          options={HEADER_POSITIONS}
          value={headerPosition}
          onChange={(value) => onChange(id, { headerPosition: value })}
        />
        <Segmented
          label="Header alignment"
          options={alignOptions}
          value={data.headerAlign ?? "start"}
          onChange={(value) => onChange(id, { headerAlign: value })}
        />
      </div>

      <div className={FIELD_LABEL}>
        Outline
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Outline color"
            value={outlineColor}
            onChange={(event) => onChange(id, { outlineColor: event.target.value })}
            className="h-8 w-10 cursor-pointer rounded-md border border-zinc-300 bg-transparent p-0.5 dark:border-zinc-700"
          />
          <div className="flex-1">
            <Segmented
              label="Outline style"
              options={OUTLINE_STYLES}
              value={data.outlineStyle ?? "solid"}
              onChange={(value) => onChange(id, { outlineStyle: value })}
            />
          </div>
        </div>
        {data.outlineColor && (
          <button
            type="button"
            className="self-start text-[11px] font-normal text-blue-600 hover:underline dark:text-blue-400"
            onClick={() => onChange(id, { outlineColor: undefined })}
          >
            {categoryColor ? "Use category color" : "Reset to default"}
          </button>
        )}
      </div>
    </>
  );
}

function ColorSwatches({
  legend,
  activeKey,
  onPick,
}: {
  legend: LegendEntry[];
  activeKey?: string;
  onPick: (key: BlockColorKey) => void;
}) {
  if (!legend.length) {
    return <p className="text-[11px] font-normal text-zinc-400">Add a legend entry below to color items.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {legend.map((entry) => (
        <button
          type="button"
          key={entry.key}
          title={entry.label}
          aria-label={entry.label}
          aria-pressed={activeKey === entry.key}
          onClick={() => onPick(entry.key)}
          className={`h-7 w-7 rounded-md border border-black/15 transition-transform hover:scale-110 dark:border-white/15 ${
            activeKey === entry.key ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950" : ""
          }`}
          style={{ backgroundColor: entry.color }}
        />
      ))}
    </div>
  );
}

/** The connections touching one component, plus a picker to add another without dragging. */
function ConnectionsSection({ nodeId }: { nodeId: string }) {
  const section = useDiagramStore((state) => getActiveSection(state.diagram));
  const addConnection = useDiagramStore((state) => state.addConnection);
  const setSelectedEdge = useDiagramStore((state) => state.setSelectedEdge);

  const labelOf = (id: string) => section.nodes.find((node) => node.id === id)?.data.label ?? "?";
  const mine = (section.edges ?? []).filter((edge) => edge.source === nodeId || edge.target === nodeId);
  const others = section.nodes.filter((node) => node.type === "block" && node.id !== nodeId);

  function connectTo(targetId: string) {
    if (!targetId) return;
    addConnection({ source: nodeId, target: targetId, ...suggestConnectionSides(section.nodes, nodeId, targetId) });
  }

  return (
    <div className={FIELD_LABEL}>
      Connections
      {mine.length > 0 && (
        <ul className="flex flex-col gap-1">
          {mine.map((edge) => {
            const outgoing = edge.source === nodeId;
            const caption = connectionCaption(edge);
            return (
              <li key={edge.id}>
                <button
                  type="button"
                  onClick={() => setSelectedEdge(edge.id)}
                  className="flex w-full items-baseline gap-1.5 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-xs font-normal hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <span aria-hidden>{edge.direction === "both" ? "↔" : edge.direction === "none" ? "—" : outgoing ? "→" : "←"}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{labelOf(outgoing ? edge.target : edge.source)}</span>
                  {caption && <span className="shrink-0 text-zinc-500">{caption}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <select
        aria-label="Connect to another component"
        className={FIELD}
        value=""
        disabled={!others.length}
        onChange={(event) => connectTo(event.target.value)}
      >
        <option value="">{others.length ? "Connect to…" : "Add another component to connect"}</option>
        {others.map((node) => (
          <option key={node.id} value={node.id}>
            {node.data.label}
          </option>
        ))}
      </select>
      <span className="text-[11px] font-normal text-zinc-400">
        Or drag from a dot on the edge of this component to another one.
      </span>
    </div>
  );
}

const DIRECTION_OPTIONS: { value: ConnectionDirection; label: string }[] = [
  { value: "forward", label: "One way" },
  { value: "both", label: "Both ways" },
  { value: "none", label: "No arrow" },
];

const LINE_OPTIONS: { value: ConnectionLineStyle; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
];

function ConnectionPanel({ edge }: { edge: DiagramEdge }) {
  const section = useDiagramStore((state) => getActiveSection(state.diagram));
  const updateConnection = useDiagramStore((state) => state.updateConnection);
  const reverseConnection = useDiagramStore((state) => state.reverseConnection);
  const deleteConnections = useDiagramStore((state) => state.deleteConnections);
  const setSelection = useDiagramStore((state) => state.setSelection);

  const end = (id: string) => (
    <button
      type="button"
      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
      onClick={() => setSelection([id])}
    >
      {section.nodes.find((node) => node.id === id)?.data.label ?? "?"}
    </button>
  );

  return (
    <div className={PANEL}>
      <h2 className={SECTION_TITLE}>Connection</h2>
      <p className="-mt-3 text-xs text-zinc-500">
        {end(edge.source)} → {end(edge.target)}
      </p>

      <label className={FIELD_LABEL}>
        What flows
        <input
          className={FIELD}
          placeholder="e.g. Orders, customer data"
          value={edge.label ?? ""}
          onChange={(event) => updateConnection(edge.id, { label: event.target.value })}
        />
      </label>
      <label className={FIELD_LABEL}>
        Protocol or technology
        <input
          className={FIELD}
          placeholder="e.g. REST, gRPC, Kafka, SFTP"
          value={edge.protocol ?? ""}
          onChange={(event) => updateConnection(edge.id, { protocol: event.target.value })}
        />
      </label>
      <label className={FIELD_LABEL}>
        Description
        <textarea
          rows={3}
          className={`${FIELD} resize-y`}
          placeholder="Frequency, volume, security, failure handling"
          value={edge.description ?? ""}
          onChange={(event) => updateConnection(edge.id, { description: event.target.value })}
        />
      </label>

      <div className={FIELD_LABEL}>
        Arrows
        <Segmented
          label="Arrows"
          options={DIRECTION_OPTIONS}
          value={edge.direction ?? "forward"}
          onChange={(direction) => updateConnection(edge.id, { direction })}
        />
      </div>
      <div className={FIELD_LABEL}>
        Line
        <Segmented
          label="Line"
          options={LINE_OPTIONS}
          value={edge.style ?? "solid"}
          onChange={(style) => updateConnection(edge.id, { style })}
        />
        <span className="text-[11px] font-normal text-zinc-400">Dashed is the usual way to show asynchronous calls.</span>
      </div>

      <div className="flex gap-2">
        <button type="button" className={ACTION_BUTTON} onClick={() => reverseConnection(edge.id)}>
          Reverse direction
        </button>
        <button type="button" onClick={() => deleteConnections([edge.id])} className={DELETE_BUTTON}>
          <Icon name="trash" className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}

function MultiSelectionPanel({ ids }: { ids: string[] }) {
  const legend = useDiagramStore((state) => state.diagram.legend);
  const arrangeSelection = useDiagramStore((state) => state.arrangeSelection);
  const updateNodesColor = useDiagramStore((state) => state.updateNodesColor);
  const duplicateSelection = useDiagramStore((state) => state.duplicateSelection);
  const deleteNodes = useDiagramStore((state) => state.deleteNodes);

  return (
    <div className={PANEL}>
      <h2 className={SECTION_TITLE}>{ids.length} items selected</h2>
      {ARRANGE_GROUPS.map((group) => (
        <div key={group.title} className={FIELD_LABEL}>
          {group.title}
          <div className="flex flex-wrap gap-1">
            {group.ops.map(({ op, label, icon }) => (
              <button
                key={op}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => arrangeSelection(op)}
                className="rounded-md border border-zinc-300 p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d={icon} />
                </svg>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className={FIELD_LABEL}>
        Color all
        <ColorSwatches legend={legend} onPick={(key) => updateNodesColor(ids, key)} />
      </div>
      <div className="flex gap-2">
        <button type="button" className={ACTION_BUTTON} onClick={duplicateSelection}>
          Duplicate
        </button>
        <button type="button" onClick={() => deleteNodes(ids)} className={DELETE_BUTTON}>
          <Icon name="trash" className="h-3.5 w-3.5" />
          Delete all
        </button>
      </div>
    </div>
  );
}

export default function PropertiesPanel() {
  const diagram = useDiagramStore((state) => state.diagram);
  const selectedNodeIds = useDiagramStore((state) => state.selectedNodeIds);
  const selectedEdgeId = useDiagramStore((state) => state.selectedEdgeId);
  const legend = useDiagramStore((state) => state.diagram.legend);
  const updateNodeLabel = useDiagramStore((state) => state.updateNodeLabel);
  const updateNodeColor = useDiagramStore((state) => state.updateNodeColor);
  const deleteNodes = useDiagramStore((state) => state.deleteNodes);
  const updateNodeDetails = useDiagramStore((state) => state.updateNodeDetails);
  const fitContainer = useDiagramStore((state) => state.fitContainer);
  const tidyContainer = useDiagramStore((state) => state.tidyContainer);
  const fitAllContainers = useDiagramStore((state) => state.fitAllContainers);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const updateContainerStyle = useDiagramStore((state) => state.updateContainerStyle);
  const setShowTechnology = useDiagramStore((state) => state.setShowTechnology);
  const showTechnology = diagram.showTechnology !== false;

  const section = getActiveSection(diagram);

  const selectedEdge = selectedEdgeId ? section.edges?.find((edge) => edge.id === selectedEdgeId) : undefined;
  if (selectedEdge) return <ConnectionPanel edge={selectedEdge} />;

  if (selectedNodeIds.length > 1) return <MultiSelectionPanel ids={selectedNodeIds} />;

  const node = section.nodes.find((candidate) => candidate.id === selectedNodeIds[0]);

  if (!node) {
    const hasNested = section.nodes.some((candidate) => candidate.parentId);
    return (
      <div className={PANEL}>
        <h2 className={SECTION_TITLE}>Diagram</h2>
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-zinc-700 dark:text-zinc-200">
          <span>
            Show technology
            <span className="block text-xs text-zinc-500">Under each component&apos;s name</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={showTechnology}
            onChange={(event) => setShowTechnology(event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-5 w-9 shrink-0 rounded-full bg-zinc-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-zinc-900 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40 dark:bg-zinc-700 dark:peer-checked:bg-zinc-100 dark:after:bg-zinc-950"
          />
        </label>
        {hasNested && (
          <button
            type="button"
            className={`${ACTION_BUTTON} self-start`}
            title="Shrink or grow every container to wrap its components"
            onClick={fitAllContainers}
          >
            Fit all containers
          </button>
        )}
        <div className="flex gap-2.5 rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <Icon name="cursor" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Select a container, component or connection to edit its details. Shift-click or drag a box to select several and line them up. Drag from a dot on a component to connect it to another.
          </p>
        </div>
      </div>
    );
  }

  const childCount = section.nodes.filter((candidate) => candidate.parentId === node.id).length;

  const parentContainer = node.parentId
    ? section.nodes.find((candidate) => candidate.id === node.parentId)
    : undefined;

  const showColor = node.type === "block" || node.type === "container";

  return (
    <div className={PANEL}>
      <h2 className={SECTION_TITLE}>
        {node.type === "container" ? "Container" : "Component"}
      </h2>
      {parentContainer && (
        <p className="-mt-3 text-xs text-zinc-500">
          In{" "}
          <button
            type="button"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            title="Select the container to resize or tidy it"
            onClick={() => setSelection([parentContainer.id])}
          >
            {parentContainer.data.label}
          </button>
        </p>
      )}

      <label className={FIELD_LABEL}>
        Label
        <input
          className={FIELD}
          value={node.data.label}
          onChange={(event) => updateNodeLabel(node.id, event.target.value)}
        />
      </label>

      {showColor && (
        <div className={FIELD_LABEL}>
          Color
          <ColorSwatches
            legend={legend}
            activeKey={node.data.colorKey}
            onPick={(key) => updateNodeColor(node.id, key)}
          />
        </div>
      )}

      {DETAIL_FIELDS.filter((field) => node.type === "block" || !field.blockOnly).map((field) => {
        const Input = field.multiline ? "textarea" : "input";
        return (
          <label key={field.key} className={FIELD_LABEL}>
            {field.label}
            <Input
              rows={field.multiline ? 3 : undefined}
              placeholder={field.placeholder}
              className={`${FIELD} resize-y`}
              value={node.data[field.key] ?? ""}
              onChange={(event) => updateNodeDetails(node.id, { [field.key]: event.target.value })}
            />
          </label>
        );
      })}

      {node.type === "block" && <ConnectionsSection nodeId={node.id} />}

      {node.data.kind === "container" && (
        <ContainerStyleControls
          id={node.id}
          data={node.data}
          legend={legend}
          onChange={updateContainerStyle}
        />
      )}

      {node.type === "container" && (
        <div className={FIELD_LABEL}>
          Layout
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={ACTION_BUTTON}
              disabled={!childCount}
              title="Arrange the components inside in a neat grid"
              onClick={() => tidyContainer(node.id)}
            >
              Tidy layout
            </button>
            <button
              type="button"
              className={ACTION_BUTTON}
              disabled={!childCount}
              title="Shrink or grow the container to wrap its components"
              onClick={() => fitContainer(node.id)}
            >
              Fit to contents
            </button>
          </div>
        </div>
      )}

      <button type="button" onClick={() => deleteNodes([node.id])} className={`${DELETE_BUTTON} self-start`}>
        <Icon name="trash" className="h-3.5 w-3.5" />
        Delete {node.type === "container" ? "container" : "component"}
      </button>
    </div>
  );
}
