import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Interviews Agent by Carinaex: accounts, credits, acceptable use, and liability.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref = from === "login" ? "/login" : from === "app" ? "/app" : "/";
  const backLabel =
    from === "login"
      ? "← Back to login"
      : from === "app"
        ? "← Back to app"
        : "← Back to home";
  const fromQs = from === "login" || from === "app" ? `?from=${from}` : "";
  const privacyHref = `/privacy${fromQs}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href={backHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
        {backLabel}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: July 3, 2026</p>

      <section className="mt-8 space-y-4 text-sm leading-6 text-muted-foreground">
        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">1. License to use the service</h2>
          <p>
            Interviews Agent grants you a limited, non-exclusive, non-transferable, revocable
            license to access and use the product for personal or internal professional interview
            preparation.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">2. Acceptable use</h2>
          <p>
            You agree not to abuse, reverse engineer, disrupt, or misuse the service, including
            attempts to bypass usage limits, automate fraudulent account creation, or upload
            unlawful content.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">3. AI-generated content disclaimer</h2>
          <p>
            Interviews Agent uses AI systems to generate recommendations and study plans. Output may
            contain inaccuracies and does not guarantee interview outcomes, job offers, or hiring
            decisions.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">4. Payments and credits</h2>
          <p>
            Paid credits are processed through Stripe. You are responsible for reviewing package
            details before purchase. Credits are consumed based on usage as described in the
            product.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">5. Termination</h2>
          <p>
            We may suspend or terminate access in cases of policy violations, fraud, or abuse. You
            can request account deletion at any time once that workflow is available in product
            settings.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">6. Contact</h2>
          <p>
            For terms-related questions, contact{" "}
            <a href="mailto:help@carinaex.com" className="text-primary hover:underline">
              help@carinaex.com
            </a>
            .
          </p>
        </div>
      </section>

      <p className="mt-8 text-sm text-muted-foreground">
        Read our{" "}
        <Link href={privacyHref} className="text-primary hover:underline">
          Privacy Policy
        </Link>{" "}
        for details about how we process your data.
      </p>
    </main>
  );
}
