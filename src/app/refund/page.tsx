import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { SHOW_PRICING_AND_REFUNDS } from "@/lib/billing-ui";

export const metadata: Metadata = {
  title: "Refund Policy | Interviews Agent",
  description: "Refund Policy for Interviews Agent.",
};

export default async function RefundPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  if (!SHOW_PRICING_AND_REFUNDS) notFound();

  const { from } = await searchParams;
  const backHref = from === "login" ? "/login" : from === "app" ? "/app" : "/";
  const backLabel =
    from === "login"
      ? "← Back to login"
      : from === "app"
        ? "← Back to app"
        : "← Back to home";
  const fromQs = from === "login" || from === "app" ? `?from=${from}` : "";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link
        href={backHref}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {backLabel}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Refund Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: July 8, 2026
      </p>

      <section className="mt-8 space-y-4 text-sm leading-6 text-muted-foreground">
        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            1. No refunds by default
          </h2>
          <p>
            We sell one-time credit packs at a fixed, clearly displayed price.
            There are no subscriptions and no recurring charges, so there is no
            risk of an accidental repeat purchase. Because credits are a digital
            good delivered to your account immediately, all purchases are final
            and non-refundable except as described below.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            2. You only pay for successful usage
          </h2>
          <p>
            Credits are charged based on actual usage. If an AI request fails on
            our side, the credits held for that request are released and not
            charged. You are never billed for a request we did not successfully
            deliver.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            3. Billing errors caused by us
          </h2>
          <p>
            If our software charges you incorrectly, for example a double
            charge, or credits deducted more than once for a single request due
            to a bug on our side, we will refund the excess amount that was
            charged in error. This is the one case where we always issue a
            refund.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            4. How to request an error refund
          </h2>
          <p>
            Email{" "}
            <a
              href="mailto:help@carinaex.com"
              className="text-primary hover:underline"
            >
              help@carinaex.com
            </a>{" "}
            from your account email within 60 days of the charge, including the
            approximate date, the amount, and a short description of what
            happened. We review each request and, when a billing error is
            confirmed, refund the excess to your original payment method
            (typically within 5–10 business days, depending on your bank).
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            5. Unused and free credits
          </h2>
          <p>
            Paid credits do not expire, but they are non-refundable once
            purchased (outside of the billing-error case above). Free monthly
            credits are provided at no cost, have no cash value, and are never
            refundable.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            6. Disputes and chargebacks
          </h2>
          <p>
            If you believe you were charged in error, please contact us first,
            we can almost always resolve it faster than a bank dispute. Opening
            a chargeback without contacting us may result in your account being
            suspended pending review.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            7. Self-hosted / local use
          </h2>
          <p>
            The open-source, self-hosted version of the software is free and
            involves no payment, so this policy does not apply to it. This
            Refund Policy covers only purchases made on our hosted service.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            8. Contact
          </h2>
          <p>
            For any billing or refund question, contact{" "}
            <a
              href="mailto:help@carinaex.com"
              className="text-primary hover:underline"
            >
              help@carinaex.com
            </a>
            .
          </p>
        </div>
      </section>

      <p className="mt-8 text-sm text-muted-foreground">
        See also our{" "}
        <Link href={`/terms${fromQs}`} className="text-primary hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href={`/privacy${fromQs}`} className="text-primary hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
