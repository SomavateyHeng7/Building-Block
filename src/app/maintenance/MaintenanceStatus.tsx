"use client";

import { useEffect, useState } from "react";
import { useMounted } from "@/components/theme-toggle";

/** How often to check whether the site is back. */
const CHECK_EVERY_MS = 30_000;

async function isBack(): Promise<boolean> {
  try {
    // The address bar still shows the page the visitor asked for; it answers 503 until we reopen.
    const response = await fetch(window.location.href, { method: "HEAD", cache: "no-store" });
    return response.status !== 503;
  } catch {
    return false;
  }
}

/** `until` is the expected end as an ISO time, or null when there isn't one (or it has passed). */
export default function MaintenanceStatus({ until }: { until: string | null }) {
  const mounted = useMounted();
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  async function check() {
    setChecking(true);
    if (await isBack()) {
      window.location.reload();
      return;
    }
    setLastChecked(new Date());
    setChecking(false);
  }

  useEffect(() => {
    const interval = setInterval(() => void check(), CHECK_EVERY_MS);
    return () => clearInterval(interval);
  }, []);

  const untilDate = until ? new Date(until) : null;

  return (
    <div className="flex flex-col items-center gap-4">
      {untilDate && mounted && (
        <p className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          Expected back by <span className="font-medium text-zinc-900 dark:text-zinc-100">{untilDate.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</span>
        </p>
      )}
      <button
        type="button"
        disabled={checking}
        onClick={() => void check()}
        className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {checking ? "Checking…" : "Try again"}
      </button>
      <p className="text-xs text-zinc-500" aria-live="polite">
        {lastChecked && mounted
          ? `Still updating at ${lastChecked.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}. We'll keep checking and reload this page when we're back.`
          : "This page checks every 30 seconds and reloads when we're back."}
      </p>
    </div>
  );
}
