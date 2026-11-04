"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PRIVACY_VERSION } from "@/lib/consent";

/**
 * Form endpoint that accepts a JSON POST of `{ email }`, e.g. a Formspree form URL.
 * Without it the form is not shown, so visitors never submit into nothing.
 */
const WAITLIST_URL = process.env.NEXT_PUBLIC_WAITLIST_URL;

type Status = "idle" | "sending" | "done" | "error";

/**
 * `source` is sent with the address, so signups from the plans page can be told apart; `topic` is what people
 * are told about ("team features", "paid plans").
 */
export default function WaitlistForm({ source = "landing", topic = "team features" }: { source?: string; topic?: string }) {
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  if (!WAITLIST_URL) {
    return process.env.NODE_ENV === "development" ? (
      <p className="text-sm text-zinc-500">
        Set <code className="font-mono">NEXT_PUBLIC_WAITLIST_URL</code> to show the waitlist form.
      </p>
    ) : null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    try {
      const response = await fetch(WAITLIST_URL!, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        // Records what was agreed to and when, alongside the address.
        body: JSON.stringify({ email, source, consent: { agreed: true, privacyVersion: PRIVACY_VERSION, at: new Date().toISOString() } }),
      });
      setStatus(response.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
        Thanks — we&apos;ll be in touch when {topic} are ready.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:flex-wrap">
      <label htmlFor="waitlist-email" className="sr-only">
        Work email
      </label>
      <input
        id="waitlist-email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-500"
      />
      <button
        type="submit"
        disabled={status === "sending" || !agreed}
        className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {status === "sending" ? "Joining…" : "Join the waitlist"}
      </button>
      <label className="flex items-start gap-2 text-xs text-zinc-500 sm:basis-full">
        <input
          type="checkbox"
          required
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
        />
        <span>
          I agree that Building Block may store my email to tell me when {topic} are ready. No diagrams are shared.
          See the{" "}
          <Link href="/privacy" className="underline hover:text-zinc-900 dark:hover:text-zinc-100">
            privacy statement
          </Link>
          . You can unsubscribe at any time.
        </span>
      </label>
      {status === "error" && (
        <p className="text-sm text-red-600 sm:basis-full dark:text-red-400">Something went wrong. Please try again.</p>
      )}
    </form>
  );
}
