import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Interviews Agent by Carinaex: what data we collect, how we use it, and your choices.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default async function PrivacyPage({
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
  const termsHref = `/terms${fromQs}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href={backHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
        {backLabel}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: July 3, 2026</p>

      <section className="mt-8 space-y-4 text-sm leading-6 text-muted-foreground">
        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">1. Data we collect</h2>
          <p>
            We collect account and usage data needed to operate the service, including your email,
            chat content, generated roadmaps, credit balances, and transaction records linked to
            Stripe checkout events.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">2. Why we process data</h2>
          <p>
            We process your data to authenticate your account, generate interview-prep output,
            process payments, prevent abuse, and provide support.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">3. Retention</h2>
          <p>
            We retain account, chat, and transaction records while your account is active and as
            needed for legal, tax, fraud-prevention, and support obligations. You may request
            deletion where applicable.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">4. Legal bases (GDPR)</h2>
          <p>
            For users in the EU/EEA/UK, our legal bases include contract performance (service
            delivery), legitimate interests (security and abuse prevention), and legal obligations
            (tax and compliance records).
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">5. Your rights</h2>
          <p>
            Depending on your jurisdiction, you may have rights to access, correct, export, or
            delete personal data, and to object to or restrict certain processing activities.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">6. Contact</h2>
          <p>
            For privacy requests or support, contact{" "}
            <a href="mailto:help@carinaex.com" className="text-primary hover:underline">
              help@carinaex.com
            </a>
            .
          </p>
        </div>
      </section>

      <p className="mt-8 text-sm text-muted-foreground">
        By using the service, you also agree to our{" "}
        <Link href={termsHref} className="text-primary hover:underline">
          Terms of Service
        </Link>
        .
      </p>
    </main>
  );
}
