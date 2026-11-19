import type { Metadata } from "next";
import { ConversionCta } from "./_components/conversion-cta";
import { Features } from "./_components/features";
import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";
import { PersonaGrids } from "./_components/persona-grids";
import { PlatformsSection } from "./_components/platforms-section";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";
import { ValueNarrative } from "./_components/value-narrative";

const TITLE = "Yo Socials · Plan, post and grow on every platform";
const DESCRIPTION =
  "The AI social media agent that drafts a content calendar for each account, publishes on time and shows how every post performs. Bluesky, Mastodon, Telegram, Discord and more.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Yo Socials",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/marketing/feed-desktop.png", width: 2880, height: 1800, alt: "Yo Socials unified feed" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/marketing/feed-desktop.png"],
  },
};

export default function LandingPage() {
  return (
    <>
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
