import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import HeroDiagram from "@/components/landing/HeroDiagram";
import WaitlistForm from "@/components/landing/WaitlistForm";

export const metadata: Metadata = {
  title: "Building Block — L0 architecture diagrams for solution architects",
  description:
    "Build consistent L0 architecture diagrams from containers, components and a legend you define. Free, no account, and nothing leaves your browser.",
};

const FEATURES = [
  {
    title: "A legend you define",
    body: "Add, rename, recolour or remove categories. Every component follows the legend, and exports include only the categories you used.",
    icon: "M4 6h4v4H4zM4 14h4v4H4zM12 8h8M12 16h8",
  },
  {
    title: "Details on every component",
    body: "Record technology, owner, description and notes. Show technology on the canvas, and flag notes with a marker.",
    icon: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3",
  },
  {
    title: "Tidy in one click",
    body: "Align, distribute and match sizes. Containers grow to fit their components, and Tidy layout lines them up in a grid.",
    icon: "M4 4v16M8 7h12M8 12h8M8 17h10",
  },
  {
    title: "Several views in one diagram",
    body: "Keep current state, target state and alternatives as tabs in the same diagram, with copy and paste between them.",
    icon: "M3 7h6l2 2h10v10H3zM3 7V5h6",
  },
  {
    title: "Export for your documents",
    body: "PNG and PDF with the title and legend included, a CSV component list for your solution document, and JSON for backups.",
    icon: "M12 4v11M7 10l5 5 5-5M5 20h14",
  },
  {
    title: "Private by default",
    body: "No account and no server. Diagrams are saved in your browser, so you can draw internal systems without asking security first. Clearing browser data deletes them, so download a JSON backup of anything you need to keep.",
    icon: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  },
];

const STEPS = [
  {
    title: "Start from a template",
    body: "Pick a ready-made L0 layout or a template your team saved, or start blank.",
  },
  {
    title: "Drop in containers and components",
    body: "Drag components into containers, colour them by category and fill in the details as you go.",
  },
  {
    title: "Export and share",
    body: "Download a PNG or PDF with the legend attached, ready for a review deck or solution document.",
  },
];

const LEVELS = [
  {
    level: "L0",
    title: "Landscape",
    body: "Systems and components grouped into domains, coloured by change type.",
    status: "Available now",
  },
  {
    level: "L1",
    title: "Interactions",
    body: "How the components talk to each other: connections, protocols and data flows.",
    status: "Coming next",
  },
  {
    level: "L2",
    title: "Component detail",
    body: "Drill down from any L1 component into its internal design, kept linked to the level above.",
    status: "Planned",
  },
];

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

const primaryButton =
  "rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]";
const secondaryButton =
  "rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

export default function LandingPage() {
  return (
    <div className="flex w-full flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-background/85 backdrop-blur dark:border-zinc-800/70">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid grid-cols-2 gap-0.5" aria-hidden>
              <span className="h-2 w-2 rounded-sm bg-[#8fd19e]" />
              <span className="h-2 w-2 rounded-sm bg-[#f6d860]" />
              <span className="h-2 w-2 rounded-sm bg-[#7c3aed]" />
              <span className="h-2 w-2 rounded-sm bg-[#1f7a4d]" />
            </span>
            Building Block
          </Link>
          <div className="hidden items-center gap-5 text-sm text-zinc-600 md:flex dark:text-zinc-400">
            <a href="#features" className="hover:text-zinc-900 dark:hover:text-zinc-100">Features</a>
            <a href="#how-it-works" className="hover:text-zinc-900 dark:hover:text-zinc-100">How it works</a>
            <a href="#roadmap" className="hover:text-zinc-900 dark:hover:text-zinc-100">Roadmap</a>
            <Link href="/templates" className="hover:text-zinc-900 dark:hover:text-zinc-100">Templates</Link>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/diagrams"
              className="hidden text-sm text-zinc-600 hover:text-zinc-900 sm:block dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              My diagrams
            </Link>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="flex max-w-3xl flex-col items-center gap-6 text-center">
            <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              For solution architects
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-balance text-zinc-950 sm:text-5xl dark:text-zinc-50">
              Architecture diagrams your whole team can read
            </h1>
            <p className="max-w-2xl text-lg text-pretty text-zinc-600 dark:text-zinc-400">
              Build consistent L0 diagrams from containers, components and a legend you define. Spend
              your time on the architecture, not on nudging boxes.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/editor/new" className={primaryButton}>
                Start drawing — it&apos;s free
              </Link>
              <Link href="/templates" className={secondaryButton}>
                Browse templates
              </Link>
            </div>
            <p className="text-sm text-zinc-500">No sign-up · Saved in your browser · Export to PNG, PDF and CSV</p>
          </div>
          <div className="w-full max-w-5xl">
            <HeroDiagram />
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
            {[
              ["Every architect draws differently", "Colours, shapes and legends change from one diagram to the next, so reviewers relearn each one."],
              ["General tools fight you", "Whiteboard and diagram apps aren't built for architecture levels, so tidying a diagram takes longer than designing it."],
              ["Details live somewhere else", "Owners, technologies and notes end up in a separate spreadsheet that quickly goes stale."],
            ].map(([title, body]) => (
              <div key={title}>
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Made for the way architects work
            </h2>
            <p className="mt-3 text-zinc-600 dark:text-zinc-400">
              Everything you need to put an L0 together quickly and keep it consistent.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  <Icon path={feature.icon} />
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900 dark:text-zinc-100">{feature.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 bg-zinc-50 dark:bg-zinc-950">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              From blank page to review-ready in minutes
            </h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                    {index + 1}
                  </span>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="roadmap" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              L0 today, L1 and L2 next
            </h2>
            <p className="mt-3 text-zinc-600 dark:text-zinc-400">
              We&apos;re starting with the landscape view and building towards linked levels you can drill into.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {LEVELS.map((level, index) => (
              <div
                key={level.level}
                className={`rounded-xl border p-6 ${
                  index === 0
                    ? "border-zinc-900 dark:border-zinc-100"
                    : "border-dashed border-zinc-300 dark:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{level.level}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      index === 0
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                    }`}
                  >
                    {level.status}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900 dark:text-zinc-100">{level.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{level.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                Building Block for teams
              </h2>
              <p className="mt-3 text-zinc-600 dark:text-zinc-400">
                One legend and template library for your whole architecture practice, shared diagrams
                with comments, and single sign-on. Join the waitlist to help shape it.
              </p>
            </div>
            <div className="flex md:justify-end">
              <WaitlistForm />
            </div>
          </div>
        </section>

        <section className="bg-zinc-950 text-zinc-50 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">Draw your next L0 in minutes</h2>
            <p className="max-w-xl text-zinc-400">Free, no account, and your diagrams never leave your browser.</p>
            <Link
              href="/editor/new"
              className="rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              Start drawing
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Building Block · Diagrams stay in your browser</span>
          <div className="flex gap-5">
            <Link href="/templates" className="hover:text-zinc-900 dark:hover:text-zinc-100">Templates</Link>
            <Link href="/diagrams" className="hover:text-zinc-900 dark:hover:text-zinc-100">My diagrams</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
