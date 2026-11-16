import { describe, expect, it } from "vitest";
import { COMPANY, SALES_HOURS, SALES_QUESTIONS, salesEmail, salesMailto, salesReplyTime } from "@/lib/site/contact";
import { contactSalesPlan } from "@/lib/site/plans";

const team = contactSalesPlan("team")!;

describe("sales email", () => {
  it("names the plan and pre-fills every question to answer", () => {
    const { subject, body } = salesEmail(team);
    expect(subject).toBe("Building Block Team plan for our company");
    expect(body).toContain(`Hello ${COMPANY}`);
    expect(body).toContain("Plan: Team");
    for (const question of SALES_QUESTIONS) expect(body).toContain(`${question}: `);
  });

  it("promises a reply the same working day, within 9:00–17:00", () => {
    expect(COMPANY).toBe("Somatech");
    expect(SALES_HOURS).toMatchObject({ start: "9:00", end: "17:00" });
    const promise = salesReplyTime();
    expect(promise).toContain("same working day");
    expect(promise).toContain("9:00–17:00");
    expect(promise).toContain(SALES_HOURS.timeZone);
  });

  it("builds a mailto link that mail apps read back exactly (spaces as %20, line breaks kept)", () => {
    const link = salesMailto("sales@example.com", team);
    expect(link.startsWith("mailto:sales@example.com?subject=")).toBe(true);
    expect(link).not.toContain("+");
    const params = new URL(link).searchParams;
    expect(params.get("subject")).toBe(salesEmail(team).subject);
    expect(params.get("body")).toBe(salesEmail(team).body);
  });
});
