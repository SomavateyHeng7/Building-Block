import type { Plan } from "@/lib/site/plans";

/** Who sells and answers for Building Block: Contact sales means emailing them. */
export const COMPANY = "Somatech";

/**
 * When sales emails are answered. Change these (and only these) if the hours or time zone change; every page that
 * promises a reply time reads them.
 */
export const SALES_HOURS = { days: "Monday to Friday", start: "9:00", end: "17:00", timeZone: "GMT+7" };

/** The reply-time promise, in one sentence. */
export function salesReplyTime(): string {
  const { days, start, end, timeZone } = SALES_HOURS;
  return `${COMPANY} replies within the same working day: ${days}, ${start}–${end} (${timeZone}). Emails sent outside those hours are answered the next working morning.`;
}

/**
 * What a company tells us when asking about a paid plan. Pre-filled in the email so a buyer answers questions
 * instead of facing a blank message, and we can reply with a plan and price without another round trip.
 */
export const SALES_QUESTIONS = ["Company", "How many people would use it", "What you need it for", "When you'd like to start"];

/** The subject and body of a sales email about `plan`. */
export function salesEmail(plan: Plan): { subject: string; body: string } {
  return {
    subject: `Building Block ${plan.name} plan for our company`,
    body: [
      `Hello ${COMPANY}, we're interested in the ${plan.name} plan for our company (or tell us if another plan would fit better).`,
      "",
      `Plan: ${plan.name}`,
      ...SALES_QUESTIONS.map((question) => `${question}: `),
      "",
    ].join("\n"),
  };
}

/** A mailto: link with the sales email pre-filled. Spaces are %20, not +, which some mail apps show literally. */
export function salesMailto(address: string, plan: Plan): string {
  const { subject, body } = salesEmail(plan);
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
