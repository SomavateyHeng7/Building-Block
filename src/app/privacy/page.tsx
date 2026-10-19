import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy · Building Block",
  description: "Your diagrams stay on your device. Building Block does not receive, store or analyse them.",
};

const SECTIONS = [
  {
    title: "Your diagrams",
    body: [
      "Diagrams are created and edited entirely in your browser. They are never uploaded to Building Block, to Somatech or to any third party, and we cannot see them.",
      "A diagram exists in your browser's memory while it is open. The only copy is the .json file you save or download to your own device. Closing or reloading the tab discards anything you have not saved.",
      "PNG and PDF exports are generated in your browser as well.",
    ],
  },
  {
    title: "What is stored in your browser",
    body: [
      "Two small preferences are kept in your browser's local storage: which editor panels are open, and whether exports use the light or dark theme. They contain no diagram content or personal information, and you can clear them at any time in your browser settings.",
      "If an earlier version of Building Block saved diagrams in your browser, the app offers to download them and then deletes those copies.",
    ],
  },
  {
    title: "Waitlist",
    body: [
      "If you join the team-features waitlist, we collect only the email address you enter. It is sent to our form provider and used only to tell you when team features are ready. We do not sell it or use it for anything else.",
      "You can ask us to remove your email at any time, and every message we send will say how to unsubscribe.",
    ],
  },
  {
    title: "Cookies, analytics and fonts",
    body: [
      "Building Block does not use advertising or analytics trackers. The site sets no cookies for visitors, other than a short-lived technical cookie used by our team to preview the site during maintenance.",
      "Fonts are served from our own domain, so your browser does not contact Google to load them.",
    ],
  },
  {
    title: "Hosting logs",
    body: [
      "Like any website, our hosting provider may keep standard server logs, such as your IP address and the pages requested, for security and reliability. These logs never include diagram content, because diagrams never reach the server.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        ← Home
      </Link>
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Privacy</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Short version: your diagrams stay on your device. Building Block does not receive, store or analyse them.
        </p>
      </header>
      {SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
