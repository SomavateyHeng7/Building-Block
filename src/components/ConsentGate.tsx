"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { acceptConsent, hasConsent, subscribeConsent } from "@/lib/consent";

/** Pages that are the app itself. The landing page and the privacy notice stay readable without accepting. */
const GATED = ["/diagrams", "/templates", "/editor"];

const POINTS = [
  {
    title: "Your diagrams stay on your device",
    body: "They're never uploaded. The only copy is the file you save, and we can't see it.",
  },
  {
    title: "A few preferences are remembered here",
    body: "Your theme, panel layout and export choices, plus a note that you accepted this notice. The app's own pages are cached so it opens offline. No tracking, no analytics.",
  },
  {
    title: "Recovery copies only if you turn them on",
    body: "With the option on, unsaved changes are kept in this browser until you save them, so a crash doesn't lose them. They never leave your device.",
  },
  {
    title: "Anything else asks first",
    body: "Joining the waitlist is optional and asks for your agreement separately.",
  },
];

/**
 * Asks for acceptance of the privacy notice before the app is used. The rest of the page can't be reached
 * (it is made inert) until the notice is accepted; "Not now" goes back to the home page.
 */
export default function ConsentGate() {
  const pathname = usePathname();
  const router = useRouter();
  // On the server, and while hydrating, assume accepted: the check needs this browser's storage.
  const accepted = useSyncExternalStore(subscribeConsent, hasConsent, () => true);
  const [agreed, setAgreed] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const open = !accepted && GATED.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  // Keep keyboard and screen-reader users inside the notice while it's open.
  useEffect(() => {
    if (!open) return;
    const others = [...document.body.children].filter((element) => element.id !== "bb-consent");
    others.forEach((element) => element.setAttribute("inert", ""));
    return () => others.forEach((element) => element.removeAttribute("inert"));
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div id="bb-consent" className="fixed inset-0 z-[400] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-summary"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h2 id="consent-title" className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Before you start
        </h2>
        <p id="consent-summary" className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Please read how Building Block handles your data, then accept to continue.
        </p>
        <ul className="mt-4 flex flex-col gap-3">
          {POINTS.map((point) => (
            <li key={point.title} className="flex gap-3 text-sm">
              <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 13l4 4L19 7" />
              </svg>
              <span>
                <span className="block font-medium text-zinc-900 dark:text-zinc-100">{point.title}</span>
                <span className="text-zinc-600 dark:text-zinc-400">{point.body}</span>
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/privacy"
          target="_blank"
          rel="noopener"
          className="mt-4 inline-block text-sm font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        >
          Read the full privacy notice (opens in a new tab)
        </Link>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">
          <input
            type="checkbox"
            autoFocus
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
          />
          <span className="text-zinc-800 dark:text-zinc-200">I have read and accept the privacy notice.</span>
        </label>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={() => router.push("/")}
          >
            Not now
          </button>
          <button
            type="button"
            disabled={!agreed}
            title={agreed ? undefined : "Tick the box above first"}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            onClick={() => acceptConsent()}
          >
            Accept and continue
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
