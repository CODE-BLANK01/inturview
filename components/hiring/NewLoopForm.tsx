"use client";

import { useHiringPaths } from "./HiringPaths";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function NewLoopForm() {
  const paths = useHiringPaths();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`${paths.api}/loops`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(body?.error || "Couldn't create the loop.");
      setBusy(false);
      return;
    }
    router.push(`${paths.loops}/${body.id}`);
  };
  return (
    <form onSubmit={submit} className="panel p-4 space-y-3 max-w-lg">
      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Loop name</span>
        <input id="new-loop-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Senior backend · payments" required autoFocus />
      </label>
      {error && <p className="text-sm text-hard">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create and add rounds
      </button>
    </form>
  );
}
