import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/landing/Footer";
import { SOCIAL_LINKS } from "@/lib/links";

export const metadata: Metadata = {
  title: "Contact · Building Block",
  description: "Questions, problems, ideas or privacy requests: get in touch with the Building Block team.",
};

/** The address people write to, set at build time. Without it the page points to the website and social pages instead. */
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

const ELSEWHERE = [
  {
    label: "Website",
    href: SOCIAL_LINKS.website,
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: SOCIAL_LINKS.facebook,
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: SOCIAL_LINKS.tiktok,
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
].filter((link) => link.href.startsWith("https://"));

/** Links to our website and social pages, from src/lib/links.ts; hidden when none are filled in. */
function ElsewhereLinks() {
  if (!ELSEWHERE.length) return null;
  return (
    <nav aria-label="Building Block elsewhere" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm text-zinc-500">Find us on</span>
      {ELSEWHERE.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {link.icon}
          {link.label}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ))}
    </nav>
  );
}

/** The address to write to, and what helps us reply. There's no form: people write from their own email. */
function EmailSection() {
  if (!CONTACT_EMAIL) {
    return process.env.NODE_ENV === "development" ? (
      <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        Set <code className="font-mono">NEXT_PUBLIC_CONTACT_EMAIL</code> to the address people should write to, then rebuild, to show it here.
      </p>
    ) : (
      <section aria-labelledby="email-title" className="flex flex-col gap-2 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 id="email-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Get in touch
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Use the website or social pages above to reach us, including for privacy requests such as removing your email from the
          waitlist. We hold no diagrams, so there are none to delete.
        </p>
      </section>
    );
  }
  const subject = encodeURIComponent("Building Block");
  return (
    <section aria-labelledby="email-title" className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex flex-col gap-1">
        <h2 id="email-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Email us
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium wrap-anywhere text-zinc-900 underline underline-offset-2 dark:text-zinc-100">
            {CONTACT_EMAIL}
          </a>{" "}
          and we&apos;ll reply, usually within two working days.
        </p>
      </div>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        <li>
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Reporting a problem?</span> Tell us what you did, what you
          expected and what happened, and which browser you use. Please don&apos;t paste confidential diagram content.
        </li>
        <li>
          <span className="font-medium text-zinc-800 dark:text-zinc-200">A privacy or data request?</span> For example, removing your
          email from the waitlist. We don&apos;t hold any diagrams, so there are none to delete.
        </li>
      </ul>
      <a
        href={`mailto:${CONTACT_EMAIL}?subject=${subject}`}
        className="inline-flex items-center gap-2 self-start rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
        </svg>
        Write an email
      </a>
    </section>
  );
}

const HELP = [
  { title: "Lost work or can't open a file?", body: "Check your Downloads folder for the .json file, then use Open a diagram file on the start page.", href: "/diagrams", link: "Start page" },
  { title: "What happens to my data?", body: "Your diagrams never leave your device. The privacy notice explains the rest.", href: "/privacy", link: "Privacy notice" },
];

export default function ContactPage() {
  return (
    <div className="flex min-h-full w-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Home
        </Link>
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Contact us</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Questions, problems, ideas or privacy requests: email us and we&apos;ll reply. Some answers are right here too.
          </p>
          <ElsewhereLinks />
        </header>

        <section aria-label="Before you write" className="grid gap-3 sm:grid-cols-2">
          {HELP.map((item) => (
            <div key={item.title} className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{item.body}</p>
              <Link href={item.href} className="mt-2 inline-block font-medium text-blue-600 hover:underline dark:text-blue-400">
                {item.link} →
              </Link>
            </div>
          ))}
        </section>

        <EmailSection />

      </main>
      <Footer />
    </div>
  );
}
