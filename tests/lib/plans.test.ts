import { describe, expect, it } from "vitest";
import { PLANS, canSubscribe, formatPrice, type Plan } from "@/lib/plans";

describe("plans", () => {
  it("start with one free plan that's available, and nothing to pay for yet", () => {
    expect(PLANS[0]).toMatchObject({ id: "free", status: "available" });
    expect(formatPrice(PLANS[0])).toBe("Free");
    expect(new Set(PLANS.map((plan) => plan.id)).size).toBe(PLANS.length);
    expect(PLANS.filter(canSubscribe)).toEqual([]);
  });

  it("show prices once they're set", () => {
    const pro: Plan = { id: "pro", name: "Pro", audience: "", status: "available", features: [], price: { amount: 9, currency: "USD", period: "month" } };
    expect(formatPrice(pro)).toBe("$9 / month");
    expect(formatPrice({ ...pro, price: { amount: 12.5, currency: "EUR", period: "year", perSeat: true } })).toBe("€12.50 per person / year");
    expect(formatPrice({ ...pro, price: undefined })).toBe("Coming soon");
  });

  it("only offer Subscribe for an available, priced plan with an https checkout link", () => {
    const base: Plan = { id: "pro", name: "Pro", audience: "", status: "available", features: [], price: { amount: 9, currency: "USD", period: "month" } };
    expect(canSubscribe({ ...base, checkoutUrl: "https://buy.example.com/pro" })).toBe(true);
    expect(canSubscribe(base)).toBe(false);
    expect(canSubscribe({ ...base, checkoutUrl: "http://buy.example.com/pro" })).toBe(false);
    expect(canSubscribe({ ...base, status: "coming-soon", checkoutUrl: "https://buy.example.com/pro" })).toBe(false);
  });
});
