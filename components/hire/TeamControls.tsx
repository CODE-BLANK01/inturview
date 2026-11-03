"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, X } from "lucide-react";
import type { OrgRole } from "@prisma/client";
import { ROLE_BLURBS, ROLE_LABELS } from "@/lib/permissions";

async function call(url: string, init: RequestInit): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } }).catch(() => null);
  const data = ((await res?.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  return { ok: !!res?.ok, data };
}

export function InviteTeammateForm({ slug, roles }: { slug: string; roles: OrgRole[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>(roles.includes("RECRUITER") ? "RECRUITER" : roles[0]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  return (
    <form
      className="panel p-5 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setNote(null);
        const { ok, data } = await call(`/api/hire/${slug}/invitations`, { method: "POST", body: JSON.stringify({ email, role }) });
        setBusy(false);
        if (!ok) return setNote({ tone: "error", text: String(data.error ?? "Couldn't send the invitation.") });
        setNote(
          data.emailed
            ? { tone: "ok", text: `Invitation sent to ${email}.` }
            : { tone: "error", text: `Saved, but the email didn't send (${String(data.emailError ?? "unknown error")}). Try again from the pending list.` },
        );
        setEmail("");
        router.refresh();
      }}
    >
      <h2 className="text-sm font-semibold">Invite a teammate</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">Work email</span>
          <input className="input w-full" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">Role</span>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
            {roles.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-text-dim">{ROLE_BLURBS[role]} They must sign in with this exact email to join.</p>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary text-sm" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send invitation
        </button>
        {note && <span role="status" className={`text-sm ${note.tone === "ok" ? "text-accent" : "text-hard"}`}>{note.text}</span>}
      </div>
    </form>
  );
}

export function ResendInvitationButton({ slug, email, role }: { slug: string; email: string; role: OrgRole }) {
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
          const { ok, data } = await call(`/api/hire/${slug}/invitations`, { method: "POST", body: JSON.stringify({ email, role }) });
          setBusy(false);
          setError(ok ? (data.emailed ? null : "Email didn't send") : String(data.error ?? "Failed"));
          router.refresh();
        }}
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Resend
      </button>
      {error && <span className="text-xs text-hard">{error}</span>}
    </span>
  );
}

export function RevokeInvitationButton({ slug, id }: { slug: string; id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn text-xs"
      disabled={busy}
      aria-label="Withdraw invitation"
      onClick={async () => {
        setBusy(true);
        await call(`/api/hire/${slug}/invitations/${id}`, { method: "DELETE" });
        setBusy(false);
        router.refresh();
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Withdraw
    </button>
  );
}

export function MemberControls({
  slug,
  memberId,
  role,
  assignable,
  isSelf,
  canRemove,
}: {
  slug: string;
  memberId: string;
  role: OrgRole;
  /** Roles the viewer may set; empty means the role can't be changed by them. */
  assignable: OrgRole[];
  isSelf: boolean;
  canRemove: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2 justify-end">
      {assignable.length > 0 ? (
        <select
          className="input text-xs py-1"
          aria-label="Role"
          value={role}
          disabled={busy}
          onChange={async (e) => {
            setBusy(true);
            setError(null);
            const { ok, data } = await call(`/api/hire/${slug}/members/${memberId}`, { method: "PATCH", body: JSON.stringify({ role: e.target.value }) });
            setBusy(false);
            if (!ok) setError(String(data.error ?? "Failed"));
            router.refresh();
          }}
        >
          {assignable.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-text-muted">{ROLE_LABELS[role]}</span>
      )}
      {(canRemove || isSelf) && (
        <button
          type="button"
          className="btn text-xs"
          disabled={busy}
          onClick={async () => {
            if (!confirm(isSelf ? "Leave this workspace?" : "Remove this teammate? They lose access straight away.")) return;
            setBusy(true);
            setError(null);
            const { ok, data } = await call(`/api/hire/${slug}/members/${memberId}`, { method: "DELETE" });
            setBusy(false);
            if (!ok) return setError(String(data.error ?? "Failed"));
            if (isSelf) window.location.assign("/hire");
            else router.refresh();
          }}
        >
          {isSelf ? "Leave" : "Remove"}
        </button>
      )}
      {error && <span className="text-xs text-hard">{error}</span>}
    </span>
  );
}
