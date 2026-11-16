"use client";

import { useEffect, useState } from "react";

/**
 * A button that copies `text` and says so in place. For an email address: a mailto link does nothing when there's
 * no mail app set up (common with webmail and on work laptops), so the address must be easy to take elsewhere.
 */
export default function CopyText({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 9h11v11H9zM5 15H4V4h11v1" />
        </svg>
        {label}
      </button>
      <span role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
        {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy: select the address and copy it" : ""}
      </span>
    </span>
  );
}
