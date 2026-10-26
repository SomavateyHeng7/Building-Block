import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/landing/Footer";
import WaitlistForm from "@/components/landing/WaitlistForm";
import { PLANS, canSubscribe, formatPrice, type Plan } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing · Building Block",
  description: "Building Block is free. Paid plans for sharing and teams are on the way.",
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
          {comingSoon && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">
              Coming soon
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{plan.audience}</p>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {comingSoon && !plan.price ? <span className="text-xl text-zinc-600 dark:text-zinc-400">Price to be announced</span> : formatPrice(plan)}
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
            Everything Building Block does today is free, and stays free. We&apos;re planning paid plans for sharing work and for
            teams; what&apos;s in them, and the prices, may change before they launch.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

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
