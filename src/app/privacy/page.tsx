import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_VERSION } from "@/lib/consent";
import WithdrawConsent from "./WithdrawConsent";

export const metadata: Metadata = {
  title: "Privacy · Building Block",
  description: "Your diagrams stay on your device. Building Block does not receive, store or analyse them.",
};

const SECTIONS = [
  {
    title: "Your diagrams",
    body: [
      "Diagrams are created and edited entirely in your browser. They are never uploaded to Building Block, to Somatech or to any third party, and we cannot see them.",
      "A diagram exists in your browser's memory while it is open. The only copy is the .json file you save or download to your own device, unless you turn on recovery copies (below). Without them, closing or reloading the tab discards anything you have not saved.",
      "PNG and PDF exports are generated in your browser as well.",
    ],
  },
  {
    title: "What is stored in your browser",
    body: [
      "A few small preferences are kept in your browser's local storage: the colour theme, which editor panels are collapsed, and your last export choices (format, light or dark style, one file or several). They contain no diagram content or personal information, and you can clear them at any time in your browser settings.",
      "When you accept this notice, the browser also keeps a note of which version you accepted and when, so you aren't asked every time.",
      "Recovery copies are off unless you turn them on (on the start page, or File in the editor). When they're on, the unsaved changes to the diagram you're editing are kept in your browser's local storage until you save them to a file or discard them, so a reload or crash doesn't lose them. The copy stays on your device and is never sent anywhere. Turning the option off deletes it.",
      "So the app opens without an internet connection, your browser caches Building Block's own pages, code and fonts. No diagram content is ever cached this way.",
      "If an earlier version of Building Block saved diagrams in your browser, the app offers to download them and then deletes those copies.",
    ],
  },
  {
    title: "Waitlist",
    body: [
      "Joining the waitlist is optional and needs your separate agreement: the form asks you to tick a box before it sends anything. If you join, we collect only the email address you enter. It is sent to our form provider and used only to tell you when team features are ready. We do not sell it or use it for anything else.",
      "You can ask us to remove your email at any time through the contact page, and every message we send will say how to unsubscribe.",
    ],
  },
  {
    title: "Writing to us",
    body: [
      "If you email us at the address on the contact page, we receive your email address, your name if your email shows it, and what you write. We use them only to reply. The app itself sends nothing: you write from your own email.",
    ],
  },
  {
    title: "Donations",
    body: [
      "Donating is optional and happens on our payment provider's website, under its own privacy policy. Building Block never sees your card or bank details. The provider may share your name, email address and the amount with us, which we use only to keep records and to thank you.",
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
      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Your acceptance</h2>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          You&apos;re asked to accept this notice once before using the app. If it changes, you&apos;ll be asked again. You can
          withdraw your acceptance at any time; you&apos;ll then be asked again before you next use the app.
        </p>
        <WithdrawConsent />
        <p className="text-xs text-zinc-500">Version {PRIVACY_VERSION}</p>
      </section>
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
