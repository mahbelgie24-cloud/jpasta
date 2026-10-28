import type { Metadata, Viewport } from "next";
import { Alexandria, Amiri, Fraunces } from "next/font/google";
import { SITE } from "@/lib/site";
import { ServiceWorker } from "@/components/providers/service-worker";
import "./globals.css";

const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  variable: "--font-alexandria",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const amiri = Amiri({
  subsets: ["arabic"],
  variable: "--font-amiri",
  display: "swap",
  weight: ["400", "700"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "JPasta — باستا طازة كل يوم | قلقيلية",
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
    title: "JPasta — باستا طازة كل يوم",
    description: SITE.description,
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "JPasta — باستا طازة كل يوم",
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
