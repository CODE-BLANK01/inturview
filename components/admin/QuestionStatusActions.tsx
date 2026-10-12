"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function QuestionStatusActions({
  questionId,
  status,
  version,
  unpublishedChanges,
}: {
  questionId: string;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  version: number;
  unpublishedChanges: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: "publish" | "retire" | "restore") => {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/questions/${questionId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const canPublish = status !== "RETIRED" && (status === "DRAFT" || unpublishedChanges);
  return (
    <div className="panel p-4 space-y-3">
      <div className="text-sm">
        {status === "PUBLISHED" && <>Live as <strong>version {version}</strong>.</>}
        {status === "DRAFT" && <>Draft. Not available to loops yet.</>}
        {status === "RETIRED" && <>Retired. Loops already using it keep working; new loops can&apos;t pick it.</>}
        {unpublishedChanges && status !== "DRAFT" && (
          <span className="block text-text-muted mt-1">You have saved changes that aren&apos;t live yet.</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {canPublish && (
          <button type="button" className="btn btn-primary text-sm" disabled={!!busy} onClick={() => act("publish")}>
            {busy === "publish" && <Loader2 className="h-4 w-4 animate-spin" />}
            {version === 0 ? "Publish" : `Publish version ${version + 1}`}
          </button>
        )}
        {status !== "RETIRED" ? (
          <button type="button" className="btn text-sm" disabled={!!busy} onClick={() => act("retire")}>
            {busy === "retire" && <Loader2 className="h-4 w-4 animate-spin" />}
            Retire
          </button>
        ) : (
          <button type="button" className="btn text-sm" disabled={!!busy} onClick={() => act("restore")}>
            {busy === "restore" && <Loader2 className="h-4 w-4 animate-spin" />}
            Restore
          </button>
        )}
      </div>
      {error && <p className="text-sm text-hard">{error}</p>}
    </div>
  );
}
