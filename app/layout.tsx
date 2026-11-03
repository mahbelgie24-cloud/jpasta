import type { Metadata, Viewport } from "next";
import { Alexandria } from "next/font/google";
import localFont from "next/font/local";
import { SITE } from "@/lib/site";
import { ServiceWorker } from "@/components/providers/service-worker";
import "./globals.css";

// Alexandria and Fraunces ship as variable fonts: omit `weight` so Next
// emits ONE variable file per subset instead of a separate static file per
// weight. The mobile Lighthouse run showed ~426 KB of font transfer across
// eight files (the hard LCP cost); the variable build cuts that substantially
// while keeping every weight the design uses.
//
// `display: optional` is the performance contract: text paints immediately in
// a metrically adjusted fallback (adjustFontFallback keeps CLS at 0) and the
// brand face is used when it is cached or arrives inside the block window.
// With `swap`, the late font repaint was itself the LCP event (4.2s on the
// throttled mobile profile) — the typeface reran LCP after FCP.
const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  variable: "--font-alexandria",
  display: "optional",
  adjustFontFallback: true,
});

// Amiri is display-only and the design ladder only uses weight 700 for it
// (`type-display`, `type-section`, bold display headings). The upstream
// Arabic file is ~101 KB and ships a second ~21 KB Latin file (for spaces);
// this self-hosted subset keeps Arabic shaping (init/medi/fina/rlig), basic
// Latin and punctuation — 64 KB in ONE file, no separate Latin face.
const amiri = localFont({
  src: "./fonts/amiri-700-ar.woff2",
  variable: "--font-amiri",
  display: "optional",
  weight: "700",
  adjustFontFallback: "Times New Roman",
});

// Fraunces is used for large Latin display accents only — never the logo
// wordmark, which lives inside the supplied SVG. The subset keeps the
// variable axis and basic Latin — 34 KB instead of Google's full face.
const fraunces = localFont({
  src: "./fonts/fraunces-latin.woff2",
  variable: "--font-fraunces",
  display: "optional",
  weight: "100 900",
  adjustFontFallback: "Times New Roman",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "JPasta — باستا طازة تُطبخ عند الطلب | قلقيلية",
    template: "%s | JPasta",
  },
  description: SITE.description,
  applicationName: "JPasta",
  keywords: [
    "باستا",
    "JPasta",
    "جي باستا",
    "قلقيلية",
    "pasta",
    "fresh pasta",
    "دجاج",
    "توصيل",
    "مطعم",
    "فلسطين",
  ],
  authors: [{ name: "JPasta" }],
  creator: "JPasta",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ar_PS",
    url: SITE.url,
    siteName: SITE.name,
    title: "JPasta — باستا طازة تُطبخ عند الطلب",
    description: SITE.description,
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "JPasta — باستا طازة تُطبخ عند الطلب",
    description: SITE.description,
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: true, address: true, email: false },
  appleWebApp: {
    capable: true,
    title: "JPasta",
    statusBarStyle: "default",
  },
  // app/favicon.ico is the file-convention fallback. The SVG and raster
  // links are explicit so modern browsers, install contexts and older user
  // agents all get a source at the expected size.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFBF7" },
    { media: "(prefers-color-scheme: dark)", color: "#0C2419" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${alexandria.variable} ${amiri.variable} ${fraunces.variable}`}
    >
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-basil-800 focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-cream-50 focus:shadow-lift"
        >
          تخطَّ إلى المحتوى
        </a>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
