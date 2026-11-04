/**
 * The plans on /pricing, in one place. Today only Free exists; the others are ideas for later, shown as
 * "Coming soon" with a way to be told when they launch.
 *
 * **Going live with a plan:** give it a `price`, set `status: "available"` and a `checkoutUrl` (e.g. a Stripe
 * Payment Link). The page then shows the price and a Subscribe button instead of "Coming soon". Taking money also
 * means updating the privacy notice (and `PRIVACY_VERSION`) and adding terms of sale; see docs/13-public-pages.md.
 */

export interface PlanPrice {
  /** In the currency's main unit, e.g. 9 for $9. */
  amount: number;
  currency: "USD" | "EUR" | "GBP" | "THB";
  period: "month" | "year";
  /** Charged per person in the team. */
  perSeat?: boolean;
}

/** What a plan allows. A limit that's left out is unlimited. */
export interface PlanLimits {
  /** Lines of Mermaid code in one sequence tab (blank lines don't count). */
  sequenceCodeLines?: number;
}

export interface Plan {
  id: string;
  name: string;
  /** Who it's for, in a few words. */
  audience: string;
  /** Unset for a plan without a price yet. Free has `amount: 0`. */
  price?: PlanPrice;
  status: "available" | "coming-soon";
  /** What it adds; for paid plans, on top of the plan before it. */
  features: string[];
  /** Where Subscribe goes once the plan is available (an https link to the payment provider). */
  checkoutUrl?: string;
  /** Drawn as the one to look at first. */
  featured?: boolean;
  limits?: PlanLimits;
}

/**
 * Whether plan limits are applied. Off for now: the limits are worked out (and can be shown), but nothing is
 * refused. Turning this on also means saying so on /pricing (the Free plan's features).
 */
export const LIMITS_ENFORCED = false;

export const FREE_SEQUENCE_CODE_LINES = 100;

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    audience: "For every architect, today",
    price: { amount: 0, currency: "USD", period: "month" },
    status: "available",
    limits: { sequenceCodeLines: FREE_SEQUENCE_CODE_LINES },
    features: [
      "Unlimited diagrams, tabs and components",
      "L0 landscapes, L1 connections and L2 internal designs",
      "Sequence diagrams, linked to your architecture",
      "Templates, and import from draw.io and Mermaid",
      "Export to PNG, SVG, PDF and CSV",
      "Works offline; your files never leave your device",
      "No account, no ads, no tracking of your diagrams",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    audience: "For architects who share their work",
    status: "coming-soon",
    featured: true,
    features: [
      "Your own templates and colour legends, reused across diagrams",
      "Exports with your logo and colours",
      "Version history for each diagram",
    ],
  },
  {
    id: "team",
    name: "Team",
    audience: "For architecture teams",
    status: "coming-soon",
    features: [
      "A shared library of diagrams and templates",
      "Comments and review on diagrams",
      "Shared legends, so every diagram uses the same categories",
    ],
  },
];

/** "Free", "$9 / month", "$12 per person / month", or "Coming soon" without a price. */
export function formatPrice(plan: Plan): string {
  const { price } = plan;
  if (!price) return "Coming soon";
  if (price.amount === 0) return "Free";
  const amount = new Intl.NumberFormat("en", {
    style: "currency",
    currency: price.currency,
    maximumFractionDigits: Number.isInteger(price.amount) ? 0 : 2,
  }).format(price.amount);
  return `${amount}${price.perSeat ? " per person" : ""} / ${price.period}`;
}

/** A plan people can subscribe to now: available, priced above zero, with an https checkout link. */
export function canSubscribe(plan: Plan): boolean {
  return plan.status === "available" && !!plan.price && plan.price.amount > 0 && !!plan.checkoutUrl?.startsWith("https://");
}

/** The plan this browser is on. There are no accounts yet, so everyone is on Free. */
export function currentPlan(): Plan {
  return PLANS.find((plan) => plan.id === "free")!;
}

/** Lines of code that count towards a limit: blank ones (and the usual trailing newline) don't. */
export function countCodeLines(code: string): number {
  return code.split("\n").filter((line) => line.trim()).length;
}

export interface LimitCheck {
  used: number;
  /** Unset when the plan has no limit. */
  limit?: number;
  /** Past the limit, whether or not limits are enforced. */
  over: boolean;
  /** Over, and limits are enforced: the action should be refused. */
  blocked: boolean;
}

/** From this share of a limit, people are told how much they have used. */
const NOTICE_FROM = 0.8;

/**
 * What to tell someone about their use of a limit, or null while they are well inside it. Honest about whether the
 * limit is applied: while it isn't enforced, going over is allowed and the message says so.
 */
export function limitNotice(check: LimitCheck, planName = "Free", unit = "lines"): string | null {
  if (check.limit === undefined || check.used < check.limit * NOTICE_FROM) return null;
  if (check.blocked) return `${check.used} of ${check.limit} ${unit}. The ${planName} plan allows ${check.limit}.`;
  if (check.over) return `${check.used} ${unit}. The ${planName} plan includes ${check.limit}; nothing is blocked yet.`;
  return `${check.used} of ${check.limit} ${unit} (${planName} plan).`;
}

/** Whether a sequence tab's Mermaid code fits the plan's line limit. */
export function checkSequenceCodeLines(code: string, plan: Plan = currentPlan(), enforced = LIMITS_ENFORCED): LimitCheck {
  const used = countCodeLines(code);
  const limit = plan.limits?.sequenceCodeLines;
  const over = limit !== undefined && used > limit;
  return { used, ...(limit !== undefined ? { limit } : {}), over, blocked: over && enforced };
}
