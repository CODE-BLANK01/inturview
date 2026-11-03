"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { sentryOptions } from "@/lib/sentryOptions";

/**
 * Last-resort error page for crashes in the root layout. Sentry runs
 * server-side everywhere else; the browser SDK only loads here, on a crash,
 * so normal pages don't carry its ~60 kB.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!Sentry.getClient()) Sentry.init(sentryOptions);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#FAF7F2",
          color: "#1A1410",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Something broke on our side.</h1>
          <p style={{ color: "#6B5E54", margin: "0 0 20px", lineHeight: 1.5 }}>
            We&apos;ve been notified. Try again, and if it keeps happening, email hello@inturview.com.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#1A1410", color: "#FAF7F2", border: 0, padding: "10px 18px", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
