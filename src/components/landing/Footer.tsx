import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import CurrentYear from "./CurrentYear";

// Anchors are absolute ("/#…") so the footer works on pages other than the landing page.
const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Roadmap", href: "/#roadmap" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "New diagram", href: "/diagrams" },
      { label: "Templates", href: "/templates" },
    ],
  },
];

const LINK = "text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="col-span-2 flex max-w-xs flex-col gap-3 md:col-span-1">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            <LogoMark className="h-6 w-6" />
            Building Block
          </Link>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Consistent L0 architecture diagrams for solution architects. Free, no account needed.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3 text-sm">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{column.title}</h2>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={LINK}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            &copy; <CurrentYear /> Building Block. Built by Somatech.
          </span>
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Your diagrams are your files
          </span>
        </div>
      </div>
    </footer>
  );
}
