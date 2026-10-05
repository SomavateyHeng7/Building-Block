"use client";

import { useState, type FormEvent } from "react";

/**
 * Form endpoint that accepts a JSON POST of `{ email }`, e.g. a Formspree form URL.
 * Without it the form is not shown, so visitors never submit into nothing.
 */
const WAITLIST_URL = process.env.NEXT_PUBLIC_WAITLIST_URL;

type Status = "idle" | "sending" | "done" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email, source: "landing" }),
      });
      setStatus(response.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
        Thanks — we&apos;ll be in touch when team features are ready.
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
        disabled={status === "sending"}
        className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {status === "sending" ? "Joining…" : "Join the waitlist"}
      </button>
      {status === "error" && (
        <p className="text-sm text-red-600 sm:basis-full dark:text-red-400">Something went wrong. Please try again.</p>
      )}
    </form>
  );
}
