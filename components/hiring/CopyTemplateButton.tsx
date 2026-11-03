"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { useHiringPaths } from "./HiringPaths";

/** Copies a published inturview loop into this workspace as a draft to edit. */
export function CopyTemplateButton({ templateId }: { templateId: string }) {
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
          const res = await fetch(`${paths.api}/loops`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ fromTemplateId: templateId }),
          }).catch(() => null);
          const body = await res?.json().catch(() => ({}));
          if (res?.ok && body?.id) return router.push(`${paths.loops}/${body.id}`);
          setError(body?.error ?? "Couldn't copy it.");
          setBusy(false);
        }}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Use this template
      </button>
      {error && <span className="text-xs text-hard">{error}</span>}
    </span>
  );
}
