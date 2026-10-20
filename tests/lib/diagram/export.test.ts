import { describe, expect, it } from "vitest";
import { csvCell, exportPixelRatio, toCsv } from "@/lib/diagram/export";

describe("CSV export", () => {
  it("quotes cells and doubles quotes inside them", () => {
    expect(csvCell('Say "hi", then go')).toBe('"Say ""hi"", then go"');
  });

  it("keeps text that would run as a spreadsheet formula as plain text", () => {
    for (const value of ['=HYPERLINK("http://example.com")', "+1", "-cmd", "@SUM(A1)", "\tx", "\rx"]) {
      expect(csvCell(value).startsWith(`"'`)).toBe(true);
    }
  });

  it("leaves ordinary text alone", () => {
    expect(csvCell("Order service")).toBe('"Order service"');
    expect(csvCell("a=b")).toBe('"a=b"');
  });

  it("joins rows with CRLF after a byte-order mark", () => {
    expect(toCsv([["a", "b"], ["c", "d"]])).toBe('﻿"a","b"\r\n"c","d"');
  });
});

describe("exportPixelRatio", () => {
  it("renders small diagrams at 2×", () => {
    expect(exportPixelRatio(1200, 800)).toBe(2);
  });

  it("keeps the canvas within iOS Safari's ~16.7 million pixel limit", () => {
    for (const [width, height] of [[3000, 2000], [8000, 6000], [12000, 300]]) {
      const ratio = exportPixelRatio(width, height);
      expect(width * ratio * (height * ratio)).toBeLessThanOrEqual(16_777_216 + 1);
      expect(Math.max(width, height) * ratio).toBeLessThanOrEqual(12000);
    }
  });
});
