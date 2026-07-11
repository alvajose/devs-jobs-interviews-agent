/** Canonical public site URL for metadata, sitemap, and OG tags. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const SITE_NAME = "Interviews Agent";
export const SITE_TAGLINE = "Interview prep roadmaps in minutes";
export const SITE_DESCRIPTION =
  "Paste a job offer or target role, get the topics to master and a personalized interview study plan with real questions by stack.";

export const SITE_KEYWORDS = [
  "interview prep",
  "technical interview",
  "coding interview",
  "interview roadmap",
  "study plan",
  "software engineer interview",
  "frontend interview",
  "backend interview",
  "React interview",
  "Laravel interview",
  "AI interview coach",
] as const;

/** Google Search Console HTML-tag verification token (optional). */
export function googleSiteVerification(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  if (!raw) return undefined;

  // People often paste the whole <meta ...> tag from Search Console; extract content=.
  const fromAttr = raw.match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
  const token = (fromAttr ?? raw)
    .replace(/^["']+|["']+$/g, "")
    .replace(/<\/?meta\b[^>]*>/gi, "")
    .trim();

  // Reject leftovers that would produce a broken meta tag.
  if (!token || /[<>\s]/.test(token)) return undefined;
  return token;
}

/** GA4 measurement ID, e.g. G-XXXXXXXXXX (optional). */
export function gaMeasurementId(): string | undefined {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || undefined;
}
