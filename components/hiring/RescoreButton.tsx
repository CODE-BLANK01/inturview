"use client";

import { useHiringPaths } from "./HiringPaths";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

export function RescoreButton({ roundRunId, label = "Re-score" }: { roundRunId: string; label?: string }) {
  const paths = useHiringPaths();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn text-xs"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch(`${paths.api}/round-runs/${roundRunId}/rescore`, { method: "POST" }).catch(() => null);
          if (!res?.ok) setError((await res?.json().catch(() => ({})))?.error ?? "Failed");
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {label}
      </button>
      {error && <span className="text-xs text-hard">{error}</span>}
    </span>
  );
}
