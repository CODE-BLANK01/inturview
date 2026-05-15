"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, Trash2, Loader2, X, AlertTriangle, CheckCircle2 } from "lucide-react";

type Status = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export interface AdminInterviewRow {
  id: string;
  status: Status;
  totalScore: number | null;
  recommendation: string | null;
  startedAt: string;
  completedAt: string | null;
  approachAcceptedAt: string | null;
  movedToCodeEarly: boolean;
  userEmail: string;
  problemTitle: string;
}

const STATUS_OPTIONS: ("ALL" | Status)[] = ["ALL", "IN_PROGRESS", "COMPLETED", "ABANDONED"];

export function InterviewsTable({ rows }: { rows: AdminInterviewRow[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = (params.get("status") as Status | null) ?? "ALL";

  const setStatus = (s: "ALL" | Status) => {
    const sp = new URLSearchParams(params.toString());
    if (s === "ALL") sp.delete("status");
    else sp.set("status", s);
    startTransition(() =>
      router.replace(`/admin/interviews${sp.toString() ? `?${sp}` : ""}`)
    );
  };

  const onDelete = async (row: AdminInterviewRow) => {
    if (
      !window.confirm(
        `Delete this interview for ${row.userEmail}?\nThis cascades to all messages and the debrief. Cannot be undone.`
      )
    )
      return;
    setActingId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/interviews/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`badge cursor-pointer text-xs ${
              status === s
                ? "border-accent bg-accent/15 text-accent"
                : "border-border text-text-muted hover:border-border-strong"
            }`}
          >
            {s.toLowerCase().replace("_", " ")}
          </button>
        ))}
      </div>

      {error && (
        <div className="panel border-hard/40 bg-hard/10 px-3 py-2 text-sm text-hard flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-text-dim">
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Problem</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">User</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Status</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Behavior</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5 text-right">Score</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Started</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-text-dim py-8">
                    No interviews match those filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const busy = actingId === row.id || pending;
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-0 hover:bg-bg-surface/40"
                    >
                      <td className="px-4 py-3 truncate font-medium max-w-[260px]">
                        {row.problemTitle}
                      </td>
                      <td className="px-4 py-3 truncate text-text-muted max-w-[220px]">
                        {row.userEmail}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`badge ${
                            row.status === "COMPLETED"
                              ? "border-easy/40 bg-easy/10 text-easy"
                              : row.status === "IN_PROGRESS"
                              ? "border-accent/40 bg-accent/10 text-accent"
                              : "border-border bg-bg-surface text-text-dim"
                          }`}
                        >
                          {row.status.toLowerCase().replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.movedToCodeEarly ? (
                          <span
                            className="badge border-medium/40 bg-medium/10 text-medium"
                            title="Skipped past [READY]"
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" /> early skip
                          </span>
                        ) : row.approachAcceptedAt ? (
                          <span
                            className="badge border-easy/40 bg-easy/10 text-easy"
                            title="Interviewer green-lit before coding"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> green-lit
                          </span>
                        ) : (
                          <span className="text-xs text-text-dim">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.totalScore !== null ? (
                          <>
                            {row.totalScore}
                            <span className="text-text-dim">/25</span>
                          </>
                        ) : (
                          <span className="text-text-dim">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-dim">
                        {new Date(row.startedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {busy && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-text-dim" />
                          )}
                          <Link
                            href={`/history/${row.id}`}
                            title="View transcript"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-surface text-text-muted hover:text-text hover:border-border-strong"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => onDelete(row)}
                            disabled={busy}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-surface text-text-muted hover:text-hard hover:border-hard/40 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
