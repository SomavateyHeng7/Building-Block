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
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    audience: "For every architect, today",
    price: { amount: 0, currency: "USD", period: "month" },
    status: "available",
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
