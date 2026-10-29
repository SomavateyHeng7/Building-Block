import { parseHexColor } from "./palette";
import type { Branding } from "./types";

/**
 * A logo and an accent colour for what a diagram is exported as: the picture's title bar, PDF pages and the
 * interactive viewer. Kept in the diagram's own file (so it travels with the diagram, and nothing is stored in
 * the browser). The logo is a small picture held as a data address; only PNG, JPEG and WebP are accepted, never SVG.
 */

/** The longest logo address kept; real logos are resized to a fraction of this. */
export const MAX_LOGO_CHARS = 400_000;
/** The height a logo is scaled to, which sits comfortably in the 52 px title bar of an export picture. */
export const LOGO_HEIGHT = 96;

const LOGO_URI = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isLogoUri(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_LOGO_CHARS && LOGO_URI.test(value);
}

/** The branding in a file, keeping only what is valid; undefined when nothing usable is left. */
export function parseBranding(raw: unknown): Branding | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { logo, color } = raw as { logo?: unknown; color?: unknown };
  const branding: Branding = {};
  if (isLogoUri(logo)) branding.logo = logo;
  const hex = typeof color === "string" ? parseHexColor(color) : null;
  if (hex) branding.color = hex;
  return branding.logo || branding.color ? branding : undefined;
}

/** Whether `branding` changes how an export looks. */
export function hasBranding(branding: Branding | undefined): branding is Branding {
  return !!branding && !!(branding.logo || branding.color);
}

/**
 * Reads a picture the person chose and scales it down to a small PNG, so the diagram file stays small.
 * Throws Error with a message for the user.
 */
export async function logoFromFile(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Choose a PNG, JPEG or WebP picture.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("That picture couldn't be read.");
    }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("That picture couldn't be read.");
    const scale = Math.min(1, LOGO_HEIGHT / image.naturalHeight, 600 / image.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const uri = canvas.toDataURL("image/png");
    if (!isLogoUri(uri)) throw new Error("That picture is too detailed to use as a logo. Try a simpler one.");
    return uri;
  } finally {
    URL.revokeObjectURL(url);
  }
}
