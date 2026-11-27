import { jsonLdScript, organizationJsonLd, publicPageMetadata } from "@/app/lib/seo";
import { SITE } from "@/app/lib/site";
import { ConversionCta } from "./_components/conversion-cta";
import { Features } from "./_components/features";
import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";
import { PersonaGrids } from "./_components/persona-grids";
import { PlatformsSection } from "./_components/platforms-section";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";
import { ValueNarrative } from "./_components/value-narrative";

export const metadata = publicPageMetadata({ title: `${SITE.name} · ${SITE.tagline}`, description: SITE.description, path: "/", absoluteTitle: true });

export default function LandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd()) }} />
      <SiteHeader />
      <main id="main" className="flex-1">
        <Hero />
        <ValueNarrative />
        <Features />
        <PersonaGrids />
        <HowItWorks />
        <PlatformsSection />
        <ConversionCta />
      </main>
      <SiteFooter />
    </>
  );
}
