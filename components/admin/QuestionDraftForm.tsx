"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";

const CATEGORIES = [
  ["RECRUITER_SCREEN", "Recruiter screen"],
  ["BEHAVIORAL", "Behavioral"],
  ["TECHNICAL", "Technical deep-dive"],
  ["CODING", "Coding"],
  ["SYSTEM_DESIGN", "System design"],
] as const;

export function QuestionDraftForm() {
  const [jobDescription, setJobDescription] = useState("");
  const [categories, setCategories] = useState<string[]>(["BEHAVIORAL", "TECHNICAL"]);
  const [count, setCount] = useState(5);
  const [level, setLevel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ids: string[]; rejected: unknown[]; costUsd: number } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/questions/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobDescription, categories, count, level: level || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Drafting failed (${res.status})`);
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drafting failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <form onSubmit={submit} className="space-y-5">
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Job description</span>
          <textarea
            id="draft-jd"
            className="input min-h-[220px] text-sm"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job post: responsibilities, requirements, team, seniority…"
            required
          />
        </label>

        <fieldset className="space-y-1">
          <legend className="text-xs uppercase tracking-[0.08em] text-text-dim">Categories</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {CATEGORIES.map(([v, l]) => (
              <label key={v} className="inline-flex items-center gap-2">
                <input
                  id={`draft-cat-${v}`}
                  type="checkbox"
                  checked={categories.includes(v)}
                  onChange={(e) => setCategories((cur) => (e.target.checked ? [...cur, v] : cur.filter((x) => x !== v)))}
                />
                {l}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-text-dim">How many</span>
            <select id="draft-count" className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Level</span>
            <select id="draft-level" className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Any</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
            </select>
          </label>
        </div>

        {error && <div className="panel border-hard/40 bg-hard/10 px-3 py-2 text-sm text-hard">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={busy || categories.length === 0}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Drafting… this takes up to a minute" : "Draft questions"}
        </button>
      </form>

      {result && (
        <div className="panel p-4 space-y-3" role="status">
          <p className="text-sm">
            <strong>{result.ids.length} drafts created.</strong> They aren&apos;t live: open each one, edit it, and publish
            the ones you want.
            {result.rejected.length > 0 && ` ${result.rejected.length} came back malformed and were skipped.`}
            <span className="text-text-dim"> Cost: ${result.costUsd.toFixed(3)}.</span>
          </p>
          <ul className="text-sm space-y-1">
            {result.ids.map((id, i) => (
              <li key={id}>
                <Link className="underline underline-offset-2" href={`/admin/questions/${id}`}>Review draft {i + 1}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
