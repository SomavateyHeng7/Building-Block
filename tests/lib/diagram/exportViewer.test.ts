import { describe, expect, it } from "vitest";
import { buildViewerHtml } from "@/lib/diagram/exportViewer";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><text>Hi &amp; bye</text></svg>`;

describe("buildViewerHtml", () => {
  it("embeds each picture at its size, with a tab per view", () => {
    const html = buildViewerHtml("Platform", [{ label: "Current", svg: SVG }, { label: "Target", svg: SVG }], false);
    expect(html).toContain("<title>Platform</title>");
    expect(html.match(/<img /g)).toHaveLength(2);
    expect(html).toContain('width="640" height="480"');
    expect(html).toContain(">Current</button>");
    expect(html).toContain(">Target</button>");
    expect(html).not.toContain('class="dark"');
  });

  it("round-trips the picture through its data address", () => {
    const html = buildViewerHtml("P", [{ label: "A", svg: SVG }], true);
    const uri = html.match(/src="data:image\/svg\+xml;charset=utf-8,([^"]+)"/)![1];
    expect(decodeURIComponent(uri)).toBe(SVG);
    expect(html).toContain('<html lang="en" class="dark">');
  });

  it("escapes names, so a title can't add markup or script", () => {
    const html = buildViewerHtml(`</title><script>alert(1)</script>`, [{ label: `"><img src=x onerror=alert(1)>`, svg: SVG }], false);
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain('"><img src=x');
    expect(html).toContain("&lt;/title&gt;");
  });

  it("falls back to a default size when the picture has none", () => {
    expect(buildViewerHtml("P", [{ label: "A", svg: "<svg></svg>" }], false)).toContain('width="800" height="600"');
  });
});
