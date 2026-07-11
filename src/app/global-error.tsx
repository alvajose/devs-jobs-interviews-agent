"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="dark h-full">
      <body className="min-h-full bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <main className="max-w-lg text-center space-y-4">
          <h1 className="text-2xl font-semibold">Something went wrong.</h1>
          <p className="text-sm text-slate-300">
            We logged the error and will take a look. Try loading this page again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
