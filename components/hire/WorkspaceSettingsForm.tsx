"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Values {
  name: string;
  timezone: string;
  website: string;
  logoUrl: string;
  contactEmail: string;
}

export function WorkspaceSettingsForm({ slug, initial, readOnly }: { slug: string; initial: Values; readOnly: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // Server and browser can ship different zone lists; fill it in after hydration.
  const [zones, setZones] = useState(() => Array.from(new Set(["UTC", initial.timezone])));
  useEffect(() => setZones(["UTC", ...Intl.supportedValuesOf("timeZone").filter((z) => z !== "UTC")]), []);
  const field = (key: keyof Values) => ({
    value: v[key],
    disabled: readOnly || busy,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [key]: e.target.value }),
  });

  return (
    <form
      className="panel p-5 space-y-4 max-w-2xl"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setNote(null);
        const res = await fetch(`/api/hire/${slug}/settings`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(v),
        }).catch(() => null);
        setBusy(false);
        if (!res?.ok) return setNote({ tone: "error", text: (await res?.json().catch(() => ({})))?.error ?? "Couldn't save." });
        setNote({ tone: "ok", text: "Saved." });
        router.refresh();
      }}
    >
      <label className="block space-y-1">
        <span className="text-xs text-text-muted">Company name</span>
        <input className="input w-full" required minLength={2} maxLength={120} {...field("name")} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-text-muted">Timezone</span>
        <select className="input w-full" {...field("timezone")}>
          {zones.map((z) => (
            <option key={z} value={z}>{z.replace(/_/g, " ")}</option>
          ))}
        </select>
        <span className="block text-xs text-text-dim">Applicants see deadlines in this timezone.</span>
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-text-muted">Contact email for applicants</span>
        <input className="input w-full" type="email" placeholder="talent@company.com" {...field("contactEmail")} />
        <span className="block text-xs text-text-dim">Shown on interview pages for accommodation and help requests.</span>
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-text-muted">Website</span>
        <input className="input w-full" type="url" placeholder="https://company.com" {...field("website")} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-text-muted">Logo URL</span>
        <input className="input w-full" type="url" placeholder="https://company.com/logo.png" {...field("logoUrl")} />
      </label>
      {!readOnly && (
        <div className="flex items-center gap-3">
          <button className="btn btn-primary text-sm" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
          {note && <span role="status" className={`text-sm ${note.tone === "ok" ? "text-accent" : "text-hard"}`}>{note.text}</span>}
        </div>
      )}
    </form>
  );
}
