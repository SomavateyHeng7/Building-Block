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

const DARK_TEXT = "#111827";
const LIGHT_TEXT = "#f9fafb";

/** WCAG relative luminance of a 6-digit hex colour. */
function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((at) => {
    const channel = parseInt(value.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two 6-digit hex colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Dark or light text, whichever has more contrast on `hex` (WCAG's measure, not a brightness cut-off: that gave
 * light text at about 3:1 on mid tones like goldenrod and rose).
 */
export function readableTextOn(hex: string): string {
  if (!/^#?[0-9a-f]{6}$/i.test(hex)) return DARK_TEXT;
  return contrastRatio(hex, DARK_TEXT) >= contrastRatio(hex, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT;
}
