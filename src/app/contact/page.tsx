import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/landing/Footer";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact · Building Block",
  description: "Questions, problems, ideas or privacy requests: get in touch with the Building Block team.",
};

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

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
            Questions, problems, ideas or privacy requests: send us a message and we&apos;ll reply by email.
            {CONTACT_EMAIL && (
              <>
                {" "}
                You can also write to{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100">
                  {CONTACT_EMAIL}
                </a>
                .
              </>
            )}
          </p>
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

        <section aria-labelledby="contact-form-title" className="flex flex-col gap-4">
          <h2 id="contact-form-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Send a message
          </h2>
          <ContactForm />
        </section>
      </main>
      <Footer />
    </div>
  );
}
