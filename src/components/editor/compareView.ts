import { create } from "zustand";
import type { ComparePair } from "@/lib/diagram/compare";

/**
 * The two tabs whose differences are marked on the canvas, if any. Screen state, not part of the diagram:
 * it isn't saved, undone or counted as a change.
 */
export const useCompareView = create<{ pair: ComparePair | null; show: (pair: ComparePair) => void; hide: () => void }>()(
  (set) => ({
    pair: null,
    show: (pair) => set({ pair }),
    hide: () => set({ pair: null }),
  }),
);
