import { AnnouncementBar } from "@/components/site/announcement-bar";
import { Featured } from "@/components/site/featured";
import { Features } from "@/components/site/features";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { Hero } from "@/components/site/hero";
import { HowToOrder } from "@/components/site/how-to-order";
import { Marquee } from "@/components/site/marquee";
import { Visit } from "@/components/site/visit";
import { SITE } from "@/lib/site";
import { serializeJsonLd } from "@/lib/json-ld";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "@id": `${SITE.url}/#restaurant`,
  name: SITE.name,
  alternateName: SITE.nameAr,
  slogan: SITE.tagline,
  description: SITE.description,
  url: SITE.url,
  image: `${SITE.url}/opengraph-image`,
  telephone: SITE.phoneIntl,
  priceRange: "₪₪",
  currenciesAccepted: "ILS",
  paymentAccepted: "Cash, Credit Card",
  servesCuisine: ["Italian", "Pasta", "Chicken"],
  address: {
    "@type": "PostalAddress",
    streetAddress: "بجانب مدرسة أبو علي اياد",
    addressLocality: "قلقيلية",
    addressCountry: "PS",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 32.1896,
    longitude: 34.9706,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAYS,
      opens: "13:00",
      closes: "23:59",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAYS,
      opens: "00:00",
      closes: "01:00",
    },
  ],
  acceptsReservations: false,
  hasMenu: `${SITE.url}/menu`,
  potentialAction: {
    "@type": "OrderAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE.url}/menu`,
      inLanguage: "ar",
      actionPlatform: [
        "http://schema.org/DesktopWebPlatform",
        "http://schema.org/MobileWebPlatform",
      ],
    },
    deliveryMethod: ["http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"],
  },
};

export default function LandingPage() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Marquee />
        <Featured />
        <Features />
        <HowToOrder />
        <Visit />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </>
  );
}
