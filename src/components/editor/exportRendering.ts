import { create } from "zustand";

/**
 * The canvas only mounts what's on screen (big diagrams stay quick to drag), but an export pictures the canvas's
 * DOM, so while one runs every node and connection is mounted.
 */
export const useRenderEverything = create<{ on: boolean; set: (on: boolean) => void }>()((set) => ({
  on: false,
  set: (on) => set({ on }),
}));
