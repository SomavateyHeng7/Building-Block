/**
 * Acceptance of the privacy notice. People accept it once before using the app; the record says which
 * version they accepted and when, so changing the notice (bump PRIVACY_VERSION) asks everyone again.
 * It is kept in this browser only. If storage is blocked, acceptance lasts until the tab is closed.
 */

/** Change this whenever the privacy notice changes in a way people should agree to again. */
export const PRIVACY_VERSION = "2026-10-26.2";
const KEY = "bb:consent";

export interface ConsentRecord {
  version: string;
  acceptedAt: string;
}

let acceptedThisSession = false;
const listeners = new Set<() => void>();

export function readConsent(): ConsentRecord | null {
  try {
    const record = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    return record && typeof record.version === "string" && typeof record.acceptedAt === "string" ? record : null;
  } catch {
    return null;
  }
}

/** True once the current version of the notice has been accepted. */
export function hasConsent(): boolean {
  return acceptedThisSession || readConsent()?.version === PRIVACY_VERSION;
}

export function acceptConsent(now = new Date()): ConsentRecord {
  const record = { version: PRIVACY_VERSION, acceptedAt: now.toISOString() };
  acceptedThisSession = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Not remembered after this tab closes; it will be asked again next time.
  }
  listeners.forEach((listener) => listener());
  return record;
}

/** Forgets the acceptance, so the notice is shown again before the app is used. */
export function withdrawConsent(): void {
  acceptedThisSession = false;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
