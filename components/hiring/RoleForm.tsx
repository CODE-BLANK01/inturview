"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useHiringPaths } from "./HiringPaths";

export interface RoleValues {
  title: string;
  seniority: string;
  location: string;
  context: string;
  loopTemplateId: string;
}

/** Create a role, or edit one when `roleId` is given. */
export function RoleForm({ roleId, initial, loops, onDone }: { roleId?: string; initial?: RoleValues; loops: { id: string; name: string }[]; onDone?: () => void }) {
  const paths = useHiringPaths();
  const router = useRouter();
  const [v, setV] = useState<RoleValues>(initial ?? { title: "", seniority: "", location: "", context: "", loopTemplateId: loops[0]?.id ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof RoleValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <form
      className="panel p-5 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await fetch(roleId ? `${paths.api}/roles/${roleId}` : `${paths.api}/roles`, {
          method: roleId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...v, loopTemplateId: v.loopTemplateId || null }),
        }).catch(() => null);
        const body = await res?.json().catch(() => ({}));
        setBusy(false);
        if (!res?.ok) return setError(body?.error ?? "Couldn't save the role.");
        if (roleId) {
          onDone?.();
          router.refresh();
        } else router.push(`${paths.roles}/${body.id}`);
      }}
    >
      {!roleId && <h2 className="text-sm font-semibold">New role</h2>}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">Title</span>
          <input className="input w-full" required minLength={2} maxLength={120} value={v.title} onChange={set("title")} placeholder="Senior backend engineer" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">Seniority</span>
          <input className="input w-full" maxLength={40} value={v.seniority} onChange={set("seniority")} placeholder="Senior" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">Location</span>
          <input className="input w-full" maxLength={80} value={v.location} onChange={set("location")} placeholder="Remote, US" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-text-muted">About the role (for your team)</span>
        <textarea className="input w-full min-h-[90px] text-sm" maxLength={6000} value={v.context} onChange={set("context")} placeholder="What the team does, what this person will own, what good looks like." />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-text-muted">Interview loop</span>
        <select className="input w-full" value={v.loopTemplateId} onChange={set("loopTemplateId")}>
          <option value="">Choose later</option>
          {loops.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {loops.length === 0 && <span className="block text-xs text-text-dim">No published loops yet. You can pick one after publishing.</span>}
      </label>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary text-sm" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {roleId ? "Save" : "Create role"}</button>
        {roleId && onDone && <button type="button" className="btn text-sm" onClick={onDone}>Cancel</button>}
        {error && <span role="alert" className="text-sm text-hard">{error}</span>}
      </div>
    </form>
  );
}

export function RoleStatusButtons({ roleId, status }: { roleId: string; status: "OPEN" | "PAUSED" | "CLOSED" }) {
  const paths = useHiringPaths();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const setStatus = async (next: "OPEN" | "PAUSED" | "CLOSED") => {
    setBusy(true);
    await fetch(`${paths.api}/roles/${roleId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) }).catch(() => null);
    setBusy(false);
    router.refresh();
  };
  return (
    <span className="inline-flex gap-2">
      {status !== "OPEN" && <button type="button" className="btn text-sm" disabled={busy} onClick={() => setStatus("OPEN")}>Reopen</button>}
      {status === "OPEN" && <button type="button" className="btn text-sm" disabled={busy} onClick={() => setStatus("PAUSED")}>Pause</button>}
      {status !== "CLOSED" && <button type="button" className="btn text-sm" disabled={busy} onClick={() => setStatus("CLOSED")}>Close role</button>}
    </span>
  );
}

/** The role's details with an Edit toggle. */
export function EditableRole({ roleId, initial, loops, children }: { roleId: string; initial: RoleValues; loops: { id: string; name: string }[]; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <RoleForm roleId={roleId} initial={initial} loops={loops} onDone={() => setEditing(false)} />;
  return (
    <div className="space-y-2">
      {children}
      <button type="button" className="text-sm text-text-muted underline underline-offset-2 hover:text-text" onClick={() => setEditing(true)}>Edit role</button>
    </div>
  );
}
