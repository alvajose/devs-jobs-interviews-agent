import type { Metadata } from "next";
import { loadLandingSampleRoadmap } from "@/lib/landing-sample";
import { siteJsonLd } from "@/lib/seo";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  siteUrl,
} from "@/lib/site";
import { isLocal } from "@/lib/mode";
import LandingPageClient, { AppWorkspacePage } from "./page-client";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} · ${SITE_TAGLINE}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: siteUrl() },
  openGraph: {
    title: `${SITE_NAME} · ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: siteUrl(),
  },
};

export default function HomePage() {
  // Local install: no marketing, no auth, no billing — the entry point IS the chat.
  if (isLocal()) return <AppWorkspacePage />;

  const sampleRoadmap = loadLandingSampleRoadmap();
  const jsonLd = siteJsonLd();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPageClient sampleRoadmap={sampleRoadmap} />
    </>
  );
}

export { AppWorkspacePage };
