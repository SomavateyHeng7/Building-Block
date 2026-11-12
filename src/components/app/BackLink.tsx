import Link from "next/link";
import type { ReactNode } from "react";

/** The "back to…" link at the top of a page: a clear, bordered button that's easy to see and to tap. */
export default function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex w-fit items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-base font-medium text-zinc-900 transition-colors hover:border-zinc-500 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
    >
      <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
        ←
      </span>
      {children}
    </Link>
  );
}
