"use client";

import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import type { ArrangeOp } from "@/lib/diagram/layout";
import type {
  BlockColorKey,
  ContainerNodeData,
  ContainerStyle,
  HeaderAlign,
  HeaderPosition,
  LegendEntry,
  NodeDetails,
  OutlineStyle,
} from "@/lib/diagram/types";

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
const ACTION_BUTTON =
  "rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900";

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
    <div role="radiogroup" aria-label={label} className="flex rounded border border-zinc-300 p-0.5 dark:border-zinc-700">
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
      <div className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
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

      <div className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Outline
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Outline color"
            value={outlineColor}
            onChange={(event) => onChange(id, { outlineColor: event.target.value })}
            className="h-7 w-9 cursor-pointer rounded border border-zinc-300 bg-transparent p-0.5 dark:border-zinc-700"
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
    <div className="flex flex-wrap gap-1.5">
      {legend.map((entry) => (
        <button
          type="button"
          key={entry.key}
          title={entry.label}
          onClick={() => onPick(entry.key)}
          className="h-6 w-6 rounded-sm border-2"
          style={{
            backgroundColor: entry.color,
            borderColor: activeKey === entry.key ? "#2563eb" : "rgba(0,0,0,0.2)",
          }}
        />
      ))}
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
    <div className="flex flex-col gap-3 border-b border-zinc-200 p-3 dark:border-zinc-800">
      <h2 className={SECTION_TITLE}>{ids.length} items selected</h2>
      {ARRANGE_GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {group.title}
          <div className="flex flex-wrap gap-1">
            {group.ops.map(({ op, label, icon }) => (
              <button
                key={op}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => arrangeSelection(op)}
                className="rounded border border-zinc-300 p-1 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d={icon} />
                </svg>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Color all
        <ColorSwatches legend={legend} onPick={(key) => updateNodesColor(ids, key)} />
      </div>
      <div className="flex gap-2">
        <button type="button" className={ACTION_BUTTON} onClick={duplicateSelection}>
          Duplicate
        </button>
        <button
          type="button"
          onClick={() => deleteNodes(ids)}
          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
        >
          Delete all
        </button>
      </div>
    </div>
  );
}

export default function PropertiesPanel() {
  const diagram = useDiagramStore((state) => state.diagram);
  const selectedNodeIds = useDiagramStore((state) => state.selectedNodeIds);
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

  const section = getActiveSection(diagram);

  if (selectedNodeIds.length > 1) return <MultiSelectionPanel ids={selectedNodeIds} />;

  const node = section.nodes.find((candidate) => candidate.id === selectedNodeIds[0]);

  if (!node) {
    return (
      <div className="flex flex-col gap-2 border-b border-zinc-200 p-3 text-xs text-zinc-400 dark:border-zinc-800">
        <p>Select a container or component to edit its properties.</p>
        {section.nodes.some((candidate) => candidate.parentId) && (
          <button
            type="button"
            className={`${ACTION_BUTTON} self-start`}
            title="Shrink or grow every container to wrap its components"
            onClick={fitAllContainers}
          >
            Fit all containers
          </button>
        )}
        <p className="text-[11px] leading-snug">
          Drag a container&apos;s edge or corner to resize it, or select it and use Fit to contents.
        </p>
        <ul className="flex flex-col gap-0.5 text-[11px] leading-snug">
          <li>Shift-click or Shift-drag to select several</li>
          <li>⌘/Ctrl + C, V, D to copy, paste, duplicate</li>
          <li>⌘/Ctrl + Z / Shift+Z to undo / redo</li>
          <li>Delete or Backspace to remove</li>
        </ul>
      </div>
    );
  }

  const childCount = section.nodes.filter((candidate) => candidate.parentId === node.id).length;

  const parentContainer = node.parentId
    ? section.nodes.find((candidate) => candidate.id === node.parentId)
    : undefined;

  const showColor = node.type === "block" || node.type === "container";

  return (
    <div className="flex flex-col gap-3 border-b border-zinc-200 p-3 dark:border-zinc-800">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {node.type === "container" ? "Container" : "Component"}
      </h2>
      {parentContainer && (
        <p className="-mt-2 text-xs text-zinc-500">
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

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Label
        <input
          className="rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          value={node.data.label}
          onChange={(event) => updateNodeLabel(node.id, event.target.value)}
        />
      </label>

      {showColor && (
        <div className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
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
          <label
            key={field.key}
            className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300"
          >
            {field.label}
            <Input
              rows={field.multiline ? 3 : undefined}
              placeholder={field.placeholder}
              className="resize-y rounded border border-zinc-300 px-2 py-1 text-sm font-normal outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              value={node.data[field.key] ?? ""}
              onChange={(event) => updateNodeDetails(node.id, { [field.key]: event.target.value })}
            />
          </label>
        );
      })}

      {node.data.kind === "container" && (
        <ContainerStyleControls
          id={node.id}
          data={node.data}
          legend={legend}
          onChange={updateContainerStyle}
        />
      )}

      {node.type === "container" && (
        <div className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
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

      <button
        type="button"
        onClick={() => deleteNodes([node.id])}
        className="self-start rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
      >
        Delete
      </button>
    </div>
  );
}
