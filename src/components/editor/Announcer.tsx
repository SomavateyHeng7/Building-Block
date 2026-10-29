"use client";

import { useEffect, useState } from "react";
import { announceChange, type Watched } from "@/lib/diagram/describe";
import { useDiagramStore } from "@/lib/diagram/store";

/** How long to wait for a burst of changes (dragging a selection, pasting) to settle before saying anything. */
const SETTLE_MS = 250;

/**
 * A live region that says what happened on the canvas, for screen readers: what is selected and what it connects
 * to, what was added or removed, and which view you have arrived on. It is out of sight; nothing changes visually.
 */
export default function Announcer() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last: Watched = useDiagramStore.getState();
    // The message that would be said for the burst so far: the first thing that happened is what the person did.
    let pending: string | null = null;
    const unsubscribe = useDiagramStore.subscribe((state) => {
      const sentence = announceChange(last, state);
      last = { diagram: state.diagram, selectedNodeIds: state.selectedNodeIds, selectedEdgeId: state.selectedEdgeId };
      if (!sentence) return;
      pending = sentence;
      clearTimeout(timer);
      timer = setTimeout(() => {
        // The same sentence twice in a row isn't re-read unless it changes, so clear it first.
        setMessage("");
        requestAnimationFrame(() => setMessage(pending ?? ""));
      }, SETTLE_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
