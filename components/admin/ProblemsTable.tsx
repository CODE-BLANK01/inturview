"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Loader2, X } from "lucide-react";
import { DifficultyBadge, TopicBadge } from "@/components/Badges";
import type { Difficulty } from "@/lib/types";

export interface AdminProblemRow {
  id: string;
  title: string;
  difficulty: Difficulty;
  topic: string;
  interviewsCount: number;
}

export function ProblemsTable({ rows }: { rows: AdminProblemRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async (row: AdminProblemRow) => {
    if (
      !window.confirm(
        `Delete "${row.title}"?\n${
          row.interviewsCount > 0
            ? `This will fail because ${row.interviewsCount} interview(s) reference it.`
            : "This cannot be undone."
        }`
      )
    )
      return;
    setActingId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/problems/${row.id}`, { method: "DELETE" });
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {rows.length} {rows.length === 1 ? "problem" : "problems"}
        </p>
        <Link href="/admin/problems/new" className="btn btn-primary">
          <Plus className="h-4 w-4" />
          New problem
        </Link>
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
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Slug</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Title</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Difficulty</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Topic</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5 text-right">Interviews</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-text-dim py-8">
                    No problems yet — create the first one.
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
                      <td className="px-4 py-3 font-mono text-xs text-text-dim">{row.id}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/problems/${row.id}`}
                          className="font-medium hover:text-accent"
                        >
                          {row.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <DifficultyBadge value={row.difficulty} />
                      </td>
                      <td className="px-4 py-3">
                        <TopicBadge value={row.topic} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                        {row.interviewsCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {busy && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-text-dim" />
                          )}
                          <Link
                            href={`/admin/problems/${row.id}`}
                            title="Edit"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-surface text-text-muted hover:text-text hover:border-border-strong"
                          >
                            <Pencil className="h-3.5 w-3.5" />
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
