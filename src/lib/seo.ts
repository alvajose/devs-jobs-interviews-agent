import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  siteUrl,
} from "@/lib/site";

/** JSON-LD for the public marketing site (SoftwareApplication + WebSite + Organization). */
export function siteJsonLd() {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}/#organization`,
        name: "Carinaex",
        url,
        email: "help@carinaex.com",
        sameAs: ["https://ko-fi.com/carinaex"],
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        url,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${url}/#organization` },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}/#app`,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        url,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "Free daily credits while in testing",
        },
        slogan: SITE_TAGLINE,
        publisher: { "@id": `${url}/#organization` },
      },
    ],
  };
}
