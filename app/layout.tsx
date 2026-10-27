import type { Metadata, Viewport } from "next";
import { Alexandria, Fraunces } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  variable: "--font-alexandria",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "JPasta — باستا طازة كل يوم | قلقيلية",
    template: "%s | JPasta",
  },
  description: SITE.description,
  keywords: [
    "باستا",
    "JPasta",
    "قلقيلية",
    "pasta",
    "fresh pasta",
    "دجاج",
    "توصيل",
  ],
  openGraph: {
    type: "website",
    locale: "ar_PS",
    siteName: SITE.name,
    title: "JPasta — باستا طازة كل يوم",
    description: SITE.description,
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FDFBF7",
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
      className={`${alexandria.variable} ${fraunces.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
