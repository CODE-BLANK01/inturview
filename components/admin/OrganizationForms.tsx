"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { slugify } from "@/lib/slug";

async function post(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
  const data = ((await res?.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  return { ok: !!res?.ok, data };
}

export function NewWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="panel p-5 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const { ok, data } = await post("/api/admin/organizations", { name, slug: slug || undefined, ownerEmail, timezone });
        setBusy(false);
        if (!ok) return setError(String(data.error ?? "Couldn't create the workspace."));
        router.push(`/admin/organizations/${data.id}${data.emailed ? "" : "?emailFailed=1"}`);
      }}
    >
      <h2 className="text-sm font-semibold">New design-partner workspace</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">Company</span>
          <input
            className="input w-full"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="Acme Robotics"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">Address (inturview.com/hire/…)</span>
          <input
            className="input w-full font-mono text-sm"
            value={slug}
            pattern="[a-z0-9](?:[a-z0-9\-]{0,38}[a-z0-9])?"
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            placeholder="acme-robotics"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">Owner&apos;s work email</span>
          <input className="input w-full" type="email" required value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="founder@acme.com" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">Timezone (IANA)</span>
          <input className="input w-full" required value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-text-dim">The owner gets an email invitation. You won&apos;t have access to the workspace yourself unless you take support access.</p>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary text-sm" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create and invite owner
        </button>
        {error && <span role="alert" className="text-sm text-hard">{error}</span>}
      </div>
    </form>
  );
}

export function OwnerInviteForm({ orgId, defaultEmail }: { orgId: string; defaultEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { ok, data } = await post(`/api/admin/organizations/${orgId}/owner-invite`, { email });
        setBusy(false);
        setNote(ok ? (data.emailed ? { tone: "ok", text: "Sent." } : { tone: "error", text: `Email failed: ${String(data.emailError)}` }) : { tone: "error", text: String(data.error ?? "Failed") });
        router.refresh();
      }}
    >
      <label className="block space-y-1">
        <span className="text-xs text-text-muted">Owner email</span>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <button className="btn text-sm" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Send owner invitation</button>
      {note && <span role="status" className={`text-sm ${note.tone === "ok" ? "text-accent" : "text-hard"}`}>{note.text}</span>}
    </form>
  );
}

export function SupportAccessForm({ orgId, active }: { orgId: string; active: { expiresAt: string; slug: string } | null }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (active) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>You have read-only access until {new Date(active.expiresAt).toLocaleString()}.</span>
        <a className="btn btn-primary text-sm" href={`/hire/${active.slug}`}>Open workspace</a>
        <button
          type="button"
          className="btn text-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await post(`/api/admin/organizations/${orgId}/support`, undefined, "DELETE");
            setBusy(false);
            router.refresh();
          }}
        >
          End access
        </button>
      </div>
    );
  }
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const { ok, data } = await post(`/api/admin/organizations/${orgId}/support`, { reason, hours });
        setBusy(false);
        if (!ok) return setError(String(data.error ?? "Failed"));
        router.refresh();
      }}
    >
      <label className="block space-y-1">
        <span className="text-xs text-text-muted">Why do you need access? The company sees this.</span>
        <textarea className="input w-full min-h-[70px] text-sm" required minLength={10} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Owner asked us to check why an invitation didn't arrive (ticket #12)." />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">For</span>
          <select className="input text-sm" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {[1, 2, 4, 8, 24].map((h) => (
              <option key={h} value={h}>{h} hour{h === 1 ? "" : "s"}</option>
            ))}
          </select>
        </label>
        <button className="btn text-sm" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Take read-only support access</button>
        {error && <span role="alert" className="text-sm text-hard">{error}</span>}
      </div>
    </form>
  );
}
