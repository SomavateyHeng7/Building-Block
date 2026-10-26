import { describe, expect, it } from "vitest";
import { DEFAULT_LEGEND } from "@/lib/diagram/defaultLegend";
import { PALETTE, colorName, contrastRatio, nextLegendColor, parseHexColor, readableTextOn } from "@/lib/diagram/palette";

describe("palette", () => {
  it("has no repeated colours or names, all as #rrggbb", () => {
    expect(new Set(PALETTE.map((color) => color.hex)).size).toBe(PALETTE.length);
    expect(new Set(PALETTE.map((color) => color.name)).size).toBe(PALETTE.length);
    expect(PALETTE.every((color) => /^#[0-9a-f]{6}$/.test(color.hex))).toBe(true);
  });

  it("names every colour of the default legend", () => {
    for (const entry of DEFAULT_LEGEND) expect(colorName(entry.color)).not.toMatch(/^Custom/);
  });

  it("names custom colours by their code", () => {
    expect(colorName("#123ABC")).toBe("Custom #123abc");
  });

  it("gives a new category the first colour nobody uses", () => {
    expect(nextLegendColor([])).toBe(PALETTE[0].hex);
    expect(nextLegendColor([PALETTE[0].hex.toUpperCase(), PALETTE[1].hex])).toBe(PALETTE[2].hex);
    expect(nextLegendColor(PALETTE.map((color) => color.hex))).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each([
    ["#1F7A4D", "#1f7a4d"],
    ["1f7a4d", "#1f7a4d"],
    ["#abc", "#aabbcc"],
    [" abc ", "#aabbcc"],
    ["#abcd", null],
    ["green", null],
    ["", null],
  ])("reads %j as %j", (input, expected) => {
    expect(parseHexColor(input)).toBe(expected);
  });
});

describe("readable text", () => {
  it("measures contrast the WCAG way", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
  });

  it("picks the text colour with more contrast, so every default legend colour reads at 4.5:1 or better", () => {
    // Mid tones that a brightness cut-off gave light text at about 3:1.
    expect(readableTextOn("#b8860b")).toBe("#111827");
    expect(readableTextOn("#e0536f")).toBe("#111827");
    expect(readableTextOn("#1f7a4d")).toBe("#f9fafb");
    for (const entry of DEFAULT_LEGEND) {
      expect(contrastRatio(entry.color, readableTextOn(entry.color)), entry.label).toBeGreaterThanOrEqual(4.5);
    }
    expect(readableTextOn("not a colour")).toBe("#111827");
  });
});
