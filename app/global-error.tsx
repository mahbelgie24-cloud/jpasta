"use client";

/** Last-resort boundary: must render its own html/body. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#FDFBF7",
          color: "#182620",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <main id="main" tabIndex={-1} style={{ maxWidth: 420 }}>
          <div
            aria-hidden
            style={{
              width: 64,
              height: 64,
              margin: "0 auto",
              borderRadius: "50%",
              border: "3px solid #EBE1BD",
              background: "#296034",
              color: "#EBE1BD",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            JP
          </div>
          <h1 style={{ marginTop: 24, fontSize: 28 }}>صار في مشكلة</h1>
          <p style={{ color: "#4A5A51", lineHeight: 1.8 }}>
            تعذّر تحميل JPasta. حدّث الصفحة وحاول مرة أخرى.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              minHeight: 48,
              padding: "0 24px",
              border: 0,
              borderRadius: 999,
              background: "#235C3E",
              color: "#FDFBF7",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            إعادة المحاولة
          </button>
        </main>
      </body>
    </html>
  );
}
