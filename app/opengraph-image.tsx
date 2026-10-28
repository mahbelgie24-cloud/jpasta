import { ImageResponse } from "next/og";

export const alt = "JPasta — Fresh Pasta & Chicken, Qalqilya";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * OG image — brand palette in a raster surface. Satori has no access to CSS
 * tokens, so the approved brand hex values are inlined here only. Latin text
 * is used because the default OG font has no Arabic glyphs; the Arabic line
 * lives in the page metadata instead.
 */
export default function OpengraphImage() {
  const strands = Array.from({ length: 14 }, (_, i) => i);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "linear-gradient(135deg, #1B4831 0%, #0C2419 70%)",
        color: "#F9F5EC",
        padding: 72,
        overflow: "hidden",
      }}
    >
      {/* warm light */}
      <div
        style={{
          position: "absolute",
          width: 720,
          height: 720,
          right: -180,
          top: -260,
          borderRadius: 999,
          background:
            "radial-gradient(circle, rgba(212,175,110,0.22) 0%, rgba(212,175,110,0) 70%)",
        }}
      />

      {/* left: editorial type */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 620,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid rgba(249,245,236,0.18)",
            borderRadius: 999,
            padding: "10px 20px",
            fontSize: 18,
            letterSpacing: 3,
            color: "#DFEEE2",
            alignSelf: "flex-start",
          }}
        >
          QALQILYA · PALESTINE
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 132,
              fontWeight: 700,
              letterSpacing: -5,
              lineHeight: 1,
            }}
          >
            JPasta
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 34,
              letterSpacing: 6,
              color: "#E3C98F",
            }}
          >
            FRESH PASTA &amp; CHICKEN
          </div>
          <div
            style={{
              marginTop: 22,
              fontSize: 26,
              color: "rgba(249,245,236,0.72)",
              maxWidth: 470,
              lineHeight: 1.45,
            }}
          >
            Handmade daily. With a lot of sauce and love.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 22,
            color: "rgba(249,245,236,0.55)",
          }}
        >
          <span>03 13:00 — 01:00</span>
          <span
            style={{
              width: 42,
              height: 1,
              background: "rgba(227,201,143,0.5)",
            }}
          />
          <span>ORDER ONLINE</span>
        </div>
      </div>

      {/* right: the plate */}
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 86,
          width: 470,
          height: 470,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 470,
            height: 470,
            borderRadius: 999,
            border: "1px solid rgba(227,201,143,0.22)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 390,
            height: 390,
            borderRadius: 999,
            background:
              "radial-gradient(circle at 40% 32%, #FDFBF7 0%, #F2EBDB 62%, #E7DDC8 100%)",
            boxShadow: "0 40px 90px rgba(0,0,0,0.45)",
          }}
        />
        {/* sauce pool */}
        <div
          style={{
            position: "absolute",
            width: 250,
            height: 210,
            borderRadius: 999,
            background:
              "radial-gradient(circle at 42% 38%, #E3C98F 0%, #B98F4C 100%)",
            opacity: 0.95,
          }}
        />
        {/* pasta nest */}
        {strands.map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 236,
              height: 26,
              borderRadius: 999,
              border: "6px solid #D4AF6E",
              borderTopColor: "transparent",
              borderBottomColor: "transparent",
              transform: `rotate(${i * 13}deg) scale(${1 - (i % 3) * 0.08})`,
              opacity: 0.9,
            }}
          />
        ))}
        {/* garnish */}
        <div
          style={{
            position: "absolute",
            width: 54,
            height: 30,
            borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
            background: "#3D8A5F",
            transform: "translate(52px, -62px) rotate(-24deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 26,
            height: 26,
            borderRadius: 999,
            background: "#B3402F",
            transform: "translate(-58px, 40px)",
          }}
        />
      </div>
    </div>,
    size,
  );
}
