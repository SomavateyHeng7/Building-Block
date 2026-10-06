"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        Your saved diagrams are not affected; they&apos;re still in this browser.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          onClick={() => retry()}
        >
          Try again
        </button>
        <Link
          href="/diagrams"
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          My diagrams
        </Link>
      </div>
    </div>
  );
}
