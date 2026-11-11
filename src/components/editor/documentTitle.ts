import { useEffect } from "react";

/**
 * Keeps `document.title` at `title` while mounted. Nothing is put back on leaving: the next page's metadata sets
 * its own title, and restoring here could run after that and overwrite it.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
