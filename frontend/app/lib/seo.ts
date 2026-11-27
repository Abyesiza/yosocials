import type { Metadata } from "next";
import { absoluteUrl, SITE } from "./site";

/** Indexable public page metadata: canonical URL plus matching Open Graph and Twitter cards. */
export function publicPageMetadata({ title, description, path, absoluteTitle = false }: { title: string; description: string; path: string; absoluteTitle?: boolean }): Metadata {
  const shareTitle = absoluteTitle ? title : `${title} · ${SITE.name}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: { type: "website", url: path, siteName: SITE.name, locale: "en_US", title: shareTitle, description, images: [SITE.ogImage] },
    twitter: { card: "summary_large_image", title: shareTitle, description, images: [SITE.ogImage.url] },
  };
}

/** Signed-in areas and auth flows: keep them out of search results. */
export const PRIVATE_METADATA: Metadata = { robots: { index: false, follow: false } };

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE.url}/#organization`,
        name: SITE.owner.name,
        url: SITE.url,
        logo: absoluteUrl(SITE.logo),
        email: SITE.email.support,
        brand: { "@type": "Brand", name: SITE.name, logo: absoluteUrl(SITE.logo) },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        name: SITE.name,
        url: SITE.url,
        description: SITE.description,
        inLanguage: "en",
        publisher: { "@id": `${SITE.url}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: SITE.name,
        url: SITE.url,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: SITE.description,
        image: absoluteUrl(SITE.ogImage.url),
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": `${SITE.url}/#organization` },
      },
    ],
  };
}

/** Serialises JSON-LD for a script tag; escaping "<" stops a value from closing the tag. */
export const jsonLdScript = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");
