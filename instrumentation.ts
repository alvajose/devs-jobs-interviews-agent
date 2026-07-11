import * as Sentry from "@sentry/nextjs";
import { validateEnv } from "@/lib/env";

export async function register() {
  // register() also runs on the edge runtime, where server-only secrets aren't present.
  if (process.env.NEXT_RUNTIME === "nodejs") validateEnv();

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    // No silent observability gap: in production, missing Sentry means exceptions go unseen.
    if ((process.env.VERCEL_ENV || process.env.NODE_ENV) === "production") {
      console.error(
        "[observability] No Sentry DSN in production, exceptions are NOT being captured. Set SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN.",
      );
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
}

export const onRequestError = Sentry.captureRequestError;
