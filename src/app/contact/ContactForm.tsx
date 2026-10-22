"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PRIVACY_VERSION } from "@/lib/consent";

/**
 * Where messages go, set at build time. CONTACT_URL is a form endpoint that accepts a JSON POST (e.g.
 * Formspree); CONTACT_EMAIL is shown on the page and used to open the visitor's email app when there's
 * no endpoint, or if sending fails.
 */
const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL;
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

const TOPICS = [
  { value: "question", label: "A question" },
  { value: "problem", label: "Report a problem" },
  { value: "feature", label: "Suggest a feature" },
  { value: "privacy", label: "Privacy or data request" },
  { value: "other", label: "Something else" },
] as const;
type Topic = (typeof TOPICS)[number]["value"];

const MAX_MESSAGE = 2000;
const FIELD =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 aria-[invalid=true]:border-red-400 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900";
const LABEL = "flex flex-col gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200";

type Status = "idle" | "sending" | "sent" | "error";

function mailtoLink(topic: Topic, message: string, name: string): string {
  const subject = `Building Block: ${TOPICS.find((option) => option.value === topic)?.label}`;
  const body = name ? `${message}\n\n${name}` : message;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<Topic>("question");
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  // A field people never see; bots fill it in.
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [touched, setTouched] = useState(false);

  // Without somewhere to deliver messages the form still shows, but can't be sent, so nothing is submitted into nothing.
  const canSend = !!CONTACT_URL || !!CONTACT_EMAIL;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const messageValid = message.trim().length >= 10;
  const errors = {
    email: touched && !emailValid ? "Enter the email address we should reply to." : null,
    message: touched && !messageValid ? "Tell us a little more (at least 10 characters)." : null,
    agreed: touched && !agreed ? "Please agree so we can use your details to reply." : null,
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    setTouched(true);
    if (!emailValid || !messageValid || !agreed) return;
    if (website) return setStatus("sent");
    if (!CONTACT_URL) {
      window.location.href = mailtoLink(topic, message, name);
      return;
    }
    setStatus("sending");
    try {
      const response = await fetch(CONTACT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          topic,
          message: message.trim(),
          source: "contact",
          consent: { agreed: true, privacyVersion: PRIVACY_VERSION, at: new Date().toISOString() },
        }),
      });
      setStatus(response.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
        <p className="font-semibold">Thanks, your message is on its way.</p>
        <p className="mt-1">We&apos;ll reply to {email.trim()}, usually within two working days.</p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={LABEL}>
          <span>
            Name <span className="font-normal text-zinc-500">(optional)</span>
          </span>
          <input className={FIELD} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} />
        </label>
        <label className={LABEL}>
          Email
          <input
            className={FIELD}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
          {errors.email && (
            <span id="contact-email-error" className="text-xs font-normal text-red-600 dark:text-red-400">
              {errors.email}
            </span>
          )}
        </label>
      </div>

      <label className={LABEL}>
        What is it about?
        <select className={FIELD} value={topic} onChange={(event) => setTopic(event.target.value as Topic)}>
          {TOPICS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {topic === "problem" && (
          <span className="text-xs font-normal text-zinc-500">
            Tell us what you did, what you expected and what happened, and which browser you use. Please don&apos;t paste
            confidential diagram content.
          </span>
        )}
        {topic === "privacy" && (
          <span className="text-xs font-normal text-zinc-500">
            For example, removing your email from the waitlist. We don&apos;t hold any diagrams, so there are none to delete.
          </span>
        )}
      </label>

      <label className={LABEL}>
        Message
        <textarea
          className={`${FIELD} min-h-36 resize-y`}
          value={message}
          maxLength={MAX_MESSAGE}
          aria-invalid={!!errors.message}
          aria-describedby="contact-message-help"
          onChange={(event) => setMessage(event.target.value)}
        />
        <span id="contact-message-help" className="flex justify-between gap-3 text-xs font-normal">
          <span className="text-red-600 dark:text-red-400">{errors.message}</span>
          <span className="shrink-0 tabular-nums text-zinc-500">
            {message.length} / {MAX_MESSAGE}
          </span>
        </span>
      </label>

      {/* Hidden from people (and screen readers); only bots fill it in. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        className="hidden"
      />

      <label className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={agreed}
          aria-invalid={!!errors.agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
        />
        <span>
          I agree that Building Block may use my name and email to reply to this message, as described in the{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100">
            privacy notice
          </Link>
          .
          {errors.agreed && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{errors.agreed}</span>}
        </span>
      </label>

      {status === "error" && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          Your message couldn&apos;t be sent. Please try again
          {CONTACT_EMAIL ? (
            <>
              , or{" "}
              <a href={mailtoLink(topic, message, name)} className="font-medium underline">
                send it from your email app
              </a>
            </>
          ) : null}
          .
        </p>
      )}

      {/* this is the part where people send message to contact us */}


      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          
          disabled={status === "sending" || !canSend}
          className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
        >
          {status === "sending" ? "Sending…" : CONTACT_URL || !canSend ? "Send message" : "Write the email"}
        </button>
        {!canSend && (
          <span className="text-xs text-zinc-500">
            {process.env.NODE_ENV === "development" ? (
              <>
                Sending is off: set <code className="font-mono">NEXT_PUBLIC_CONTACT_URL</code> and/or{" "}
                <code className="font-mono">NEXT_PUBLIC_CONTACT_EMAIL</code>, then rebuild.
              </>
            ) : (
              "Messages can't be sent from here just yet. Please check back soon."
            )}
          </span>
        )}
        {canSend && !CONTACT_URL && <span className="text-xs text-zinc-500">Opens your email app with the message filled in.</span>}
      </div>
    </form>
  );
}
