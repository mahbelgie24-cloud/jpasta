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

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: SITE.name,
  alternateName: SITE.nameAr,
  slogan: SITE.tagline,
  servesCuisine: ["Italian", "Pasta", "Chicken"],
  telephone: SITE.phoneIntl,
  priceRange: "₪₪",
  address: {
    "@type": "PostalAddress",
    streetAddress: "بجانب مدرسة أبو علي اياد",
    addressLocality: "قلقيلية",
    addressCountry: "PS",
  },
  openingHours: SITE.hoursSchema,
  acceptsReservations: false,
  hasMenu: `${SITE.url}/menu`,
};

export default function LandingPage() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main id="main">
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
