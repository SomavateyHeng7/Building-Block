import { describe, expect, it } from "vitest";
import { DEFAULT_LEGEND } from "@/lib/diagram/defaultLegend";
import { PALETTE, colorName, nextLegendColor, parseHexColor } from "@/lib/diagram/palette";

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
