"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

/**
 * True while the editor is in view mode: on phones it opens this way, for reading a diagram someone
 * sent. Pan, pinch to zoom and tap for details work; nothing can be moved, added or changed.
 */
export const ReadOnlyContext = createContext(false);

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}

/** Whether a media query matches, kept up to date; `serverValue` is used during SSR and hydration. */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  return useSyncExternalStore(
    (callback) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", callback);
      return () => list.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
