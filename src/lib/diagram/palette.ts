/**
 * Named colours offered for legend categories and container outlines. Chosen to be easy to tell apart
 * on the canvas and in print, and to include the default legend's colours so those show by name.
 * Rows: soft, strong, neutral.
 */
export interface PaletteColor {
  name: string;
  hex: string;
}

export const PALETTE: PaletteColor[] = [
  { name: "Mint", hex: "#8fd19e" },
  { name: "Sky", hex: "#7dd3fc" },
  { name: "Lavender", hex: "#c4b5fd" },
  { name: "Butter", hex: "#f6d860" },
  { name: "Peach", hex: "#fdba74" },
  { name: "Rose", hex: "#fda4af" },
  { name: "Forest", hex: "#1f7a4d" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Violet", hex: "#7c3aed" },
  { name: "Gold", hex: "#b8860b" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Crimson", hex: "#e0536f" },
  { name: "White", hex: "#ffffff" },
  { name: "Mist", hex: "#e5e7eb" },
  { name: "Grey", hex: "#9ca3af" },
  { name: "Slate", hex: "#475569" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Charcoal", hex: "#27272a" },
];

/** Columns in the picker grid: one palette row each. */
export const PALETTE_COLUMNS = 6;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** "Mint", or "Custom #123456" for a colour that isn't in the palette. */
export function colorName(hex: string): string {
  return PALETTE.find((color) => same(color.hex, hex))?.name ?? `Custom ${hex.toLowerCase()}`;
}

/** The colour a new legend category gets: the first palette colour nobody uses, vivid ones before neutrals. */
export function nextLegendColor(used: string[]): string {
  return PALETTE.find((color) => !used.some((hex) => same(hex, color.hex)))?.hex ?? PALETTE[used.length % PALETTE.length].hex;
}

/** #rrggbb from what someone typed: accepts "#abc", "abc", "#aabbcc" and "aabbcc"; null when it isn't a colour. */
export function parseHexColor(input: string): string | null {
  const value = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(value)) return `#${value}`;
  if (/^[0-9a-f]{3}$/.test(value)) return `#${[...value].map((digit) => digit + digit).join("")}`;
  return null;
}

/** Dark or light text, whichever reads better on `hex`. */
export function readableTextOn(hex: string): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return "#111827";
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#f9fafb";
}
