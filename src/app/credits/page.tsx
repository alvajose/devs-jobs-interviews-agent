"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, Heart } from "lucide-react";
import { isLocal } from "@/lib/mode";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DAILY_FREE_CREDITS, FREE_CREDIT_CAP, TOKENS_PER_CREDIT } from "@/lib/credits-math";

// Paid credit packs via Stripe are DISABLED for now (no merchant/tax setup yet). While in
// testing, every account gets a free daily allowance and there's nothing to buy. The Stripe
// checkout/confirm/webhook routes and their PACKAGES are kept in place (see src/app/api/stripe/*)
// so payments can be switched back on later,  the buy UI and the packages mirror once lived here.

export default function CreditsPage() {
  const [credits, setCredits] = useState<{
    total: number;
    free: number;
    paid: number;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBalance = useCallback(async () => {
    const res = await fetch("/api/credits/balance");
    if (res.ok) setCredits(await res.json());
    else if (res.status === 401) setMessage("Sign in to see your credits.");
  }, []);

  // Local mode has no billing,  bounce back home.
  const router = useRouter();
  useEffect(() => {
    if (isLocal()) router.replace("/");
  }, [router]);

  useEffect(() => {
    void (async () => {
      await loadBalance();
    })();
  }, [loadBalance]);

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-4 py-10">
      <div className="w-full max-w-2xl">
        <Link
          href="/app"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          ← Back to app
        </Link>
      </div>

      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center gap-2">
          <h1 className="font-heading text-2xl font-semibold">Credits</h1>
          <button
            type="button"
            popoverTarget="credits-help"
            className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-quaternary hover:text-foreground"
            aria-label="How credits work"
          >
            <Info className="size-4" />
          </button>
          <div
            id="credits-help"
            popover="auto"
            className="max-w-xs rounded-lg border bg-popover p-3 text-left text-sm text-popover-foreground shadow-md"
          >
            <p className="font-medium">How credits work</p>
            <p className="mt-1 text-muted-foreground">
              1 credit covers about {TOKENS_PER_CREDIT.toLocaleString()}{" "}
              billable tokens (model input + output). Every AI call costs at
              least 1 credit.
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {credits === null
            ? "…"
            : `You have ${credits.total} credit${credits.total === 1 ? "" : "s"}.`}
        </p>
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Free while we&apos;re in testing</CardTitle>
            <CardDescription>
              Every account gets {DAILY_FREE_CREDITS} free credits a day, up to{" "}
              {FREE_CREDIT_CAP} saved up. No purchase needed, come back and keep
              prepping.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto text-sm text-muted-foreground">
            Paid credit packs will come once billing is set up. For now,
            it&apos;s on us.
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="size-4 text-primary" /> Support the project
            </CardTitle>
            <CardDescription>
              Interviews Agent is free to use right now. If it helps you land a
              role, you can support the project on Ko-fi.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <a
              href="https://ko-fi.com/carinaex"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Donate on Ko-fi
            </a>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
