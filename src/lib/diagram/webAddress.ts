/** Longest web address kept against a component. */
export const MAX_ADDRESS_LENGTH = 2000;

/**
 * The address to link to for what someone typed, or null when it isn't a plain http(s) web address. Only these are
 * ever made into links: anything else (javascript:, data:, file:) is kept as text at most, never followed.
 */
export function safeWebAddress(value: string | undefined): string | null {
  const text = value?.trim();
  if (!text || text.length > MAX_ADDRESS_LENGTH) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
