import { create } from "zustand";

/**
 * Asks the editor to show the details panel: below the lg breakpoint it's a closed drawer, and on wide screens
 * it may be collapsed (EditorApp listens). `focusId` is a field in the panel to put the cursor in once it shows.
 */
export const useDetailsRequest = create<{ request: { focusId?: string } | null }>()(() => ({ request: null }));

export function showDetails(focusId?: string) {
  useDetailsRequest.setState({ request: { focusId } });
}
