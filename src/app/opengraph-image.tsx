import { ImageResponse } from "next/og";

// The picture shown when a link to the site is pasted into Slack, Teams, LinkedIn and the like. Every page uses
// it unless it has its own. Drawn at build time with the brand mark and a small landscape of boxes.
export const alt = "Building Block: L0 architecture diagrams for solution architects";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN = "#176B4D";
const MINT = "#7BC8A0";

function Box({ label, color, text = "#0a0a0a" }: { label: string; color: string; text?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 150,
        height: 64,
        borderRadius: 10,
        border: "2px solid #d4d4d8",
        background: color,
        color: text,
        fontSize: 22,
        fontWeight: 600,
      }}
    >
      {label}
    </div>
  );
}

function Container({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 20,
        borderRadius: 14,
        border: "2px dashed #a1a1aa",
        background: "#fafafa",
      }}
    >
      <div style={{ display: "flex", fontSize: 18, fontWeight: 600, color: "#52525b" }}>{title}</div>
      {children}
    </div>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#ffffff", padding: 72, gap: 56 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, width: 72, height: 72, padding: 13, borderRadius: 16, background: GREEN }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: "#ffffff" }} />
              <div style={{ width: 20, height: 20, borderRadius: 4, background: MINT }} />
              <div style={{ width: 20, height: 20, borderRadius: 4, background: "#ffffff" }} />
              <div style={{ width: 20, height: 20, borderRadius: 4, background: "#ffffff" }} />
            </div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#0a0a0a" }}>Building Block</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1.1, color: "#0a0a0a" }}>
              L0 architecture diagrams for solution architects
            </div>
            <div style={{ display: "flex", fontSize: 28, color: "#52525b" }}>Free, no account. Your diagrams stay on your device.</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 }}>
          <Container title="Channels">
            <div style={{ display: "flex", gap: 16 }}>
              <Box label="Web" color={MINT} />
              <Box label="Mobile" color={MINT} />
            </div>
          </Container>
          <Container title="Core services">
            <div style={{ display: "flex", gap: 16 }}>
              <Box label="Orders" color={GREEN} text="#ffffff" />
              <Box label="Payments" color="#ffffff" />
            </div>
          </Container>
        </div>
      </div>
    ),
    size,
  );
}
