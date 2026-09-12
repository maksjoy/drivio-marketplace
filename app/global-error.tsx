"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-prairie-600">We recorded the error. Please try again.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-xl bg-rig-700 px-5 py-3 font-semibold text-white"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
