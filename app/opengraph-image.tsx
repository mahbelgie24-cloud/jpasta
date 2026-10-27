import { ImageResponse } from "next/og";

export const alt = "JPasta — Fresh Pasta & Chicken";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** OG image — brand colors, Latin text only (default font has no Arabic glyphs). */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        background: "linear-gradient(135deg, #1B4831 0%, #0C2419 100%)",
        color: "#F9F5EC",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 36,
            background: "#235C3E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 72,
          }}
        >
          🍝
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: -2 }}>
            JPasta
          </div>
          <div style={{ fontSize: 30, color: "#E3C98F", letterSpacing: 8 }}>
            FRESH PASTA &amp; CHICKEN
          </div>
        </div>
      </div>
      <div style={{ fontSize: 30, color: "#F9F5EC", opacity: 0.75 }}>
        Qalqilya — Order online
      </div>
    </div>,
    size,
  );
}
