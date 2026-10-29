import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/landing/Footer";
import { CHANGELOG } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "What's new · Building Block",
  description: "What has changed in Building Block, newest first.",
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export default function ChangelogPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Home
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">What&apos;s new</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Changes to Building Block, newest first.</p>
        <ol className="mt-10 flex flex-col gap-10">
          {CHANGELOG.map((entry) => (
            <li key={entry.date + entry.title}>
              <article aria-labelledby={`entry-${entry.date}`}>
                <time dateTime={entry.date} className="text-sm text-zinc-500">
                  {formatDate(entry.date)}
                </time>
                <h2 id={`entry-${entry.date}`} className="mt-1 text-lg font-semibold">
                  {entry.title}
                </h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-zinc-700 dark:text-zinc-300">
                  {entry.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      </main>
      <Footer />
    </div>
  );
}
