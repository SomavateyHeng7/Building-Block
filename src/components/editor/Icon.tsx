/** Stroke icons for the editor chrome, drawn on a 24×24 grid. */
export const ICONS = {
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  check: "M5 13l4 4L19 7",
  chevronDown: "m6 9 6 6 6-6",
  code: "m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
  copy: "M8 8h12v12H8zM16 8V4H4v12h4",
  cursor: "M5 3l14 7-6 2-2 6z",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  file: "M6 3h8l4 4v14H6zM14 3v4h4",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  keyboard: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  layers: "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5",
  panel: "M4 4h16v16H4zM14 4v16",
  panelLeft: "M4 4h16v16H4zM10 4v16",
  pencil: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  plus: "M12 5v14M5 12h14",
  redo: "m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
  save: "M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
  sequence: "M6 3v18M18 3v18M6 8h11M15 6l2 2-2 2M18 15H7M9 13l-2 2 2 2",
  swap: "M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  user: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  x: "M6 6l12 12M18 6 6 18",
} as const;

export function Icon({ name, className = "h-4 w-4" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}
