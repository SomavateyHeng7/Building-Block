import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found · Building Block",
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-5 p-6 text-center">
      <span className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#176B4D] p-2.5" aria-hidden>
        <span className="h-4 w-4 rounded bg-white" />
        <span className="h-4 w-4 rounded border-2 border-dashed border-[#7BC8A0]" />
        <span className="h-4 w-4 rounded bg-white" />
        <span className="h-4 w-4 rounded bg-white" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">This page is missing a block</h1>
      <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        The link may be mistyped, or the page has moved. Your diagrams are safe in this browser.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/diagrams"
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          My diagrams
        </Link>
        <Link
          href="/"
          className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
