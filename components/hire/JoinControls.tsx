"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { signOutTo } from "@/lib/signOutTo";

export function AcceptInvitationButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-primary text-sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch("/api/hire/join", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token }),
          }).catch(() => null);
          const data = await res?.json().catch(() => ({}));
          if (res?.ok && data?.slug) return window.location.assign(`/hire/${data.slug}`);
          setError(data?.error ?? "Couldn't accept the invitation. Try again.");
          setBusy(false);
        }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Accept and open workspace
      </button>
      {error && <p role="alert" className="text-sm text-hard">{error}</p>}
    </div>
  );
}

export function SignOutAndSwitch({ to }: { to: string }) {
  return (
    <button type="button" className="btn btn-primary text-sm" onClick={() => void signOutTo(to)}>
      Sign out and switch account
    </button>
  );
}
