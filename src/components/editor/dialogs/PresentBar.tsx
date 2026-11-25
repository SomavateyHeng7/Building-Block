"use client";

import { useEffect, useState } from "react";
import { useDiagramStore } from "@/lib/diagram/store";
import { currentStepIndex, presentSteps, stepPresentation } from "../shared/present";
import { Icon } from "../shared/Icon";

/** The controls stay out of the picture once the pointer has been still this long. */
const HIDE_AFTER_MS = 2500;

const BUTTON =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

/**
 * The little control strip shown while presenting: back, where you are, forward, and Exit. It fades away when the
 * pointer rests (the arrow keys still work) and returns when it moves, so the diagram has the whole screen.
 */
export default function PresentBar({ onExit }: { onExit: () => void }) {
  const diagram = useDiagramStore((state) => state.diagram);
  const [awake, setAwake] = useState(true);
  const steps = presentSteps(diagram);
  const index = currentStepIndex(diagram, steps);
  const step = steps[index];

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function wake() {
      setAwake(true);
      clearTimeout(timer);
      timer = setTimeout(() => setAwake(false), HIDE_AFTER_MS);
    }
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, []);

  const label = step ? (step.tabLabel ? `${step.tabLabel} › ${step.label}` : step.label) : "Nothing to show yet";

  return (
    <div
      role="toolbar"
      aria-label="Presentation controls"
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] transition-opacity duration-300 ${
        awake ? "opacity-100" : "opacity-0 focus-within:opacity-100"
      }`}
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full bg-zinc-900/90 p-1 shadow-xl backdrop-blur">
        <button type="button" className={BUTTON} aria-label="Previous" title="Previous (←)" disabled={index <= 0} onClick={() => stepPresentation(-1)}>
          <Icon name="arrowLeft" />
        </button>
        <span className="min-w-0 max-w-[50vw] truncate px-2 text-sm text-zinc-100" aria-live="polite">
          {label}
          {steps.length > 1 && index >= 0 && <span className="ml-2 text-zinc-400">{index + 1} / {steps.length}</span>}
        </span>
        <button
          type="button"
          className={BUTTON}
          aria-label="Next"
          title="Next (→)"
          disabled={index >= steps.length - 1 && index >= 0}
          onClick={() => stepPresentation(1)}
        >
          <Icon name="arrowLeft" className="h-4 w-4 rotate-180" />
        </button>
        <span className="mx-1 h-5 w-px bg-white/20" aria-hidden />
        <button type="button" className={BUTTON} title="Exit (Esc)" onClick={onExit}>
          <Icon name="x" />
          Exit
        </button>
      </div>
    </div>
  );
}
