import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "JPasta — Fresh Pasta & Chicken, Qalqilya";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * OG image — the brand roundel is the identity, so the layout does not repeat
 * the wordmark in another typeface. The approved hex values are inlined here
 * because Satori cannot read CSS tokens; the roundel itself is the supplied
 * transparent PNG export.
 */
export default async function OpengraphImage() {
  const fraunces = await readFile(
    join(process.cwd(), "app/fonts/fraunces-og.ttf"),
  );
  const roundel = `data:image/png;base64,${(
    await readFile(join(process.cwd(), "public/brand/logo-512.png"))
  ).toString("base64")}`;

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
              display: "flex",
              flexDirection: "column",
              fontFamily: "Fraunces",
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: -1,
            }}
          >
            <span>Fresh pasta,</span>
            <span>cooked to order.</span>
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 27,
              lineHeight: 1.45,
              color: "rgba(249,245,236,0.72)",
              maxWidth: 470,
            }}
          >
            House sauce made fresh daily. A lot of love. Order online, or call
            the shop.
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

      {/* right: the supplied roundel */}
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 80,
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
        <img
          src={roundel}
          width={420}
          height={420}
          alt=""
          style={{ objectFit: "contain" }}
        />
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Fraunces",
          data: fraunces,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}
