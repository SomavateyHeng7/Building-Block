"use client";

import { useState, useSyncExternalStore } from "react";
import { hasConsent, readConsent, subscribeConsent, withdrawConsent } from "@/lib/consent";
import { useMounted } from "@/components/theme-toggle";

/** Shows when this browser accepted the notice, and lets people take it back. */
export default function WithdrawConsent() {
  const mounted = useMounted();
  const accepted = useSyncExternalStore(subscribeConsent, hasConsent, () => false);
  const [withdrawn, setWithdrawn] = useState(false);
  if (!mounted) return null;
  if (!accepted) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {withdrawn
          ? "Done. You'll be asked to accept this notice again before using the app."
          : "You haven't accepted this notice in this browser yet. You'll be asked before you use the app."}
      </p>
    );
  }
  const acceptedAt = readConsent()?.acceptedAt;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
      <span>
        You accepted this notice
        {acceptedAt ? ` on ${new Date(acceptedAt).toLocaleDateString(undefined, { dateStyle: "long" })}` : ""}.
      </span>
      <button
        type="button"
        className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        onClick={() => {
          withdrawConsent();
          setWithdrawn(true);
        }}
      >
        Withdraw my acceptance
      </button>
    </div>
  );
}
