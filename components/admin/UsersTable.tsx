"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Flag,
  FlagOff,
  Ban,
  CheckCircle2,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Loader2,
  X,
} from "lucide-react";

type Role = "USER" | "ADMIN";

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  flagged: boolean;
  flagReason: string | null;
  disabledAt: string | null;
  createdAt: string;
  interviewsCount: number;
}

interface Props {
  users: AdminUserRow[];
  currentAdminId: string;
}

const FILTERS = ["all", "flagged", "disabled", "admin"] as const;
type Filter = (typeof FILTERS)[number];

export function UsersTable({ users, currentAdminId }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const initialQ = params.get("q") ?? "";
  const initialFilter = (params.get("filter") as Filter | null) ?? "all";

  const [q, setQ] = useState(initialQ);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [flagDialogFor, setFlagDialogFor] = useState<AdminUserRow | null>(null);

  // Update URL when filters change (server reads them on refresh).
  const updateUrl = (next: { q?: string; filter?: Filter }) => {
    const sp = new URLSearchParams();
    const eff = { q: next.q ?? q, filter: next.filter ?? filter };
    if (eff.q) sp.set("q", eff.q);
    if (eff.filter && eff.filter !== "all") sp.set("filter", eff.filter);
    startTransition(() => router.replace(`/admin/users${sp.toString() ? `?${sp}` : ""}`));
  };

  const filtered = useMemo(() => users, [users]);

  const doAction = async (
    user: AdminUserRow,
    body: Record<string, unknown>,
    confirmMsg?: string
  ) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActingId(user.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActingId(null);
    }
  };

  const doDelete = async (user: AdminUserRow) => {
    if (
      !window.confirm(
        `Delete ${user.email}? This cascades to ALL their interviews, messages, and debriefs. This cannot be undone.`
      )
    )
      return;
    setActingId(user.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
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
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateUrl({ q });
          }}
          className="relative flex-1 max-w-md"
        >
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            className="input pl-9"
            placeholder="Search by email or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        <div className="flex gap-1 text-xs">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                updateUrl({ filter: f });
              }}
              className={`badge cursor-pointer ${
                filter === f
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-text-muted hover:border-border-strong"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
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
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Email</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Role</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Status</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5 text-right">Interviews</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Joined</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-text-dim py-8">
                    No users match those filters.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const isSelf = u.id === currentAdminId;
                  const isAdmin = u.role === "ADMIN";
                  const isDisabled = !!u.disabledAt;
                  const busy = actingId === u.id || pending;
                  return (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-bg-surface/40">
                      <td className="px-4 py-3">
                        <div className="font-medium truncate">{u.email}</div>
                        {u.name && (
                          <div className="text-xs text-text-dim truncate">{u.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`badge ${
                            isAdmin
                              ? "border-hard/40 bg-hard/10 text-hard"
                              : "border-border bg-bg-surface text-text-muted"
                          }`}
                        >
                          {u.role.toLowerCase()}
                          {isSelf && <span className="ml-1 text-text-dim">· you</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 space-x-1">
                        {u.flagged && (
                          <span
                            className="badge border-medium/40 bg-medium/10 text-medium"
                            title={u.flagReason ?? undefined}
                          >
                            flagged
                          </span>
                        )}
                        {isDisabled && (
                          <span className="badge border-hard/40 bg-hard/10 text-hard">
                            disabled
                          </span>
                        )}
                        {!u.flagged && !isDisabled && (
                          <span className="text-xs text-text-dim">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                        {u.interviewsCount}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-dim">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {busy && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-text-dim" />
                          )}
                          {u.flagged ? (
                            <IconBtn
                              title="Unflag"
                              onClick={() => doAction(u, { flagged: false })}
                              disabled={busy}
                            >
                              <FlagOff className="h-3.5 w-3.5" />
                            </IconBtn>
                          ) : (
                            <IconBtn
                              title="Flag"
                              onClick={() => setFlagDialogFor(u)}
                              disabled={busy}
                            >
                              <Flag className="h-3.5 w-3.5" />
                            </IconBtn>
                          )}
                          {isDisabled ? (
                            <IconBtn
                              title="Re-enable"
                              onClick={() => doAction(u, { disabled: false })}
                              disabled={busy}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </IconBtn>
                          ) : (
                            <IconBtn
                              title="Disable"
                              onClick={() =>
                                doAction(
                                  u,
                                  { disabled: true },
                                  `Disable ${u.email}? They won't be able to sign in.`
                                )
                              }
                              disabled={busy || isSelf}
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </IconBtn>
                          )}
                          {isAdmin ? (
                            <IconBtn
                              title="Revoke admin"
                              onClick={() =>
                                doAction(
                                  u,
                                  { role: "USER" },
                                  `Demote ${u.email} from admin to user?`
                                )
                              }
                              disabled={busy || isSelf}
                            >
                              <ShieldOff className="h-3.5 w-3.5" />
                            </IconBtn>
                          ) : (
                            <IconBtn
                              title="Make admin"
                              onClick={() =>
                                doAction(
                                  u,
                                  { role: "ADMIN" },
                                  `Promote ${u.email} to admin?`
                                )
                              }
                              disabled={busy}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </IconBtn>
                          )}
                          <IconBtn
                            title="Delete"
                            danger
                            onClick={() => doDelete(u)}
                            disabled={busy || isSelf}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconBtn>
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

      {flagDialogFor && (
        <FlagDialog
          user={flagDialogFor}
          onClose={() => setFlagDialogFor(null)}
          onSubmit={async (reason) => {
            await doAction(flagDialogFor, { flagged: true, flagReason: reason });
            setFlagDialogFor(null);
          }}
        />
      )}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-surface text-text-muted hover:text-text hover:border-border-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? "hover:text-hard hover:border-hard/40" : ""
      }`}
    >
      {children}
    </button>
  );
}

function FlagDialog({
  user,
  onClose,
  onSubmit,
}: {
  user: AdminUserRow;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold mb-1">Flag user</h3>
        <p className="text-sm text-text-muted mb-4">
          Add an internal note about why <span className="text-text">{user.email}</span> is being
          flagged. Visible only to admins.
        </p>
        <textarea
          className="input"
          rows={3}
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={async () => {
              setSubmitting(true);
              await onSubmit(reason.trim() || "");
              setSubmitting(false);
            }}
            disabled={submitting}
          >
            Flag user
          </button>
        </div>
      </div>
    </div>
  );
}
