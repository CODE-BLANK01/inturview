"use client";

import { useState } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";

export function CheckoutButton({
  label,
  className = "btn btn-primary",
}: {
  label: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beginCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        redirect?: string;
      };
      if (response.status === 401) {
        window.location.assign(
          `/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`
        );
        return;
      }
      if (body.redirect) {
        window.location.assign(body.redirect);
        return;
      }
      if (!response.ok || !body.url) {
        throw new Error(body.error || "Could not start checkout.");
      }
      window.location.assign(body.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not start checkout."
      );
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={beginCheckout}
        disabled={loading}
        className={className}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowUpRight className="h-4 w-4" />
        )}
        {loading ? "Opening secure checkout…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-hard max-w-xs">{error}</p>}
    </div>
  );
}
