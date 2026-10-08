import type { Metadata } from "next";
import { connection } from "next/server";
import { LogoMark } from "@/components/Logo";
import { readMaintenanceConfig, upcomingEnd } from "@/lib/maintenance";
import MaintenanceStatus from "./MaintenanceStatus";

export const metadata: Metadata = {
  title: "Updating — Building Block",
  description: "Building Block is being updated and will be back shortly.",
  robots: { index: false, follow: false },
};

export default async function MaintenancePage() {
  // The message and end time come from the environment at request time, not at build time.
  await connection();
  const config = readMaintenanceConfig();
  const until = upcomingEnd(config);

  return (
    <main className="flex min-h-dvh w-full flex-1 flex-col items-center justify-center px-4 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(4rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="flex w-full max-w-lg flex-col items-center gap-8 text-center">
        <div className="relative" aria-hidden>
          <LogoMark className="h-16 w-16 motion-safe:animate-pulse" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-background bg-amber-500" />
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-zinc-950 sm:text-4xl dark:text-zinc-50">
            We&apos;re updating Building Block
          </h1>
          <p className="text-pretty text-zinc-600 dark:text-zinc-400">
            {config.message ?? "We're rolling out improvements and new features. It won't take long — thanks for your patience."}
          </p>
        </div>

        <MaintenanceStatus until={until} />

        <div className="flex w-full gap-3 rounded-xl bg-zinc-50 p-4 text-left text-sm text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Your diagrams are safe</h2>
            <p className="mt-1">
              They live in files on your device, not on our servers, so the update can&apos;t touch them. If you still have a diagram
              open in another tab, keep working and save it as usual.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
