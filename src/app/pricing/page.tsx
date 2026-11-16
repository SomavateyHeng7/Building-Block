import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/landing/Footer";
import WaitlistForm from "@/components/landing/WaitlistForm";
import { COMPANY, salesReplyTime } from "@/lib/site/contact";
import { PLANS, canSubscribe, formatPrice, isContactSales, type Plan } from "@/lib/site/plans";

export const metadata: Metadata = {
  title: "Pricing · Building Block",
  description: "Building Block is free. Plans for companies and enterprises are arranged with us directly.",
};

/** How people hear about plans that aren't out yet: the waitlist if it's on, else the contact address. */
const WAITLIST_ON = !!process.env.NEXT_PUBLIC_WAITLIST_URL;
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

const PRIMARY =
  "inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]";
const SECONDARY =
  "inline-flex items-center justify-center rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900";

function PlanAction({ plan }: { plan: Plan }) {
  if (plan.id === "free") {
    return (
      <Link href="/diagrams" className={plan.featured ? PRIMARY : SECONDARY}>
        Start drawing
      </Link>
    );
  }
  if (isContactSales(plan)) {
    return (
      <div className="flex flex-col gap-2">
        <Link href={`/contact?plan=${plan.id}`} className={plan.featured ? PRIMARY : SECONDARY}>
          Contact sales<span className="sr-only"> about {plan.name}: email {COMPANY}</span>
        </Link>
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400" aria-hidden>
          By email to {COMPANY} · same-day reply
        </p>
      </div>
    );
  }
  if (canSubscribe(plan)) {
    return (
      <a href={plan.checkoutUrl} target="_blank" rel="noopener noreferrer" className={plan.featured ? PRIMARY : SECONDARY}>
        Subscribe<span className="sr-only"> to {plan.name} (opens our payment provider in a new tab)</span>
      </a>
    );
  }
  if (WAITLIST_ON) {
    return (
      <a href="#notify" className={plan.featured ? PRIMARY : SECONDARY}>
        Notify me<span className="sr-only"> when {plan.name} launches</span>
      </a>
    );
  }
  if (CONTACT_EMAIL) {
    return (
      <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Building Block ${plan.name}`)}`} className={plan.featured ? PRIMARY : SECONDARY}>
        Ask about {plan.name}
      </a>
    );
  }
  return null;
}

function PlanCard({ plan }: { plan: Plan }) {
  const comingSoon = plan.status === "coming-soon";
  return (
    <section
      aria-labelledby={`plan-${plan.id}`}
      className={`flex flex-col gap-5 rounded-2xl border p-6 ${
        plan.featured ? "border-zinc-900 shadow-sm dark:border-zinc-100" : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h2 id={`plan-${plan.id}`} className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            {plan.name}
          </h2>
          {isContactSales(plan) && (
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-400/15 dark:text-sky-200">
              For companies
            </span>
          )}
          {comingSoon && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">
              Coming soon
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{plan.audience}</p>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {isContactSales(plan) ? (
          <span className="text-xl">{formatPrice(plan)}</span>
        ) : comingSoon && !plan.price ? (
          <span className="text-xl text-zinc-600 dark:text-zinc-400">Price to be announced</span>
        ) : (
          formatPrice(plan)
        )}
      </p>
      <ul className="flex flex-1 flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        {plan.id !== "free" && <li className="font-medium text-zinc-900 dark:text-zinc-100">Everything in Free, plus:</li>}
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m5 12 5 5L20 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>
      <PlanAction plan={plan} />
    </section>
  );
}

/** Pro or Team, side by side as "pick this if…", and what Contact sales actually involves. */
function ChoosePlan() {
  const paid = PLANS.filter(isContactSales);
  if (!paid.length) return null;
  return (
    <section id="choose" aria-labelledby="choose-title" className="flex scroll-mt-20 flex-col gap-5 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
      <div className="flex flex-col gap-1">
        <h2 id="choose-title" className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          {paid.map((plan) => plan.name).join(" or ")}?
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">The question is whether your people work on the same diagrams at the same time.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {paid.map((plan) => (
          <div key={plan.id} className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">Choose {plan.name} if…</p>
            <p className="flex-1 text-zinc-700 dark:text-zinc-300">{plan.bestFor}</p>
            <Link href={`/contact?plan=${plan.id}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
              Contact sales about {plan.name} →
            </Link>
          </div>
        ))}
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Still not sure? Contact sales about either and say so: we&apos;ll suggest one.</p>

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
        <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">How Contact sales works</h3>
        <ol className="grid gap-3 text-sm sm:grid-cols-3">
          {[
            ["Email " + COMPANY, "Contact sales opens an email to " + COMPANY + " with a few questions filled in: your company, team size and needs."],
            ["A reply the same working day", salesReplyTime()],
            ["Your plan and price", "The reply suggests the plan that fits and a price for your company, and answers your questions."],
          ].map(([title, body], index) => (
            <li key={title} className="flex gap-3">
              <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                {index + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
                <span className="text-zinc-600 dark:text-zinc-400">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function PricingPage() {
  const upcoming = PLANS.some((plan) => plan.status === "coming-soon");
  return (
    <div className="flex min-h-full w-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Home
        </Link>
        <header className="flex max-w-2xl flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Pricing</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Everything Building Block does today is free, and stays free. Pro and Team are for companies and enterprises. There&apos;s
            no checkout: you email {COMPANY}, the company behind Building Block, and we set up a plan and a price for your organisation.{" "}
            <a href="#choose" className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100">
              Pro or Team: which fits?
            </a>
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        <ChoosePlan />

        {upcoming && WAITLIST_ON && (
          <section id="notify" aria-labelledby="notify-title" className="flex scroll-mt-20 flex-col gap-3 rounded-2xl bg-zinc-50 p-6 dark:bg-zinc-950">
            <h2 id="notify-title" className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Hear when paid plans launch
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">One email when they&apos;re ready, nothing else.</p>
            <WaitlistForm source="pricing" topic="paid plans" />
          </section>
        )}

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Something you&apos;d pay for that isn&apos;t here?{" "}
          <Link href="/contact" className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100">
            Tell us
          </Link>
          .
        </p>
      </main>
      <Footer />
    </div>
  );
}
