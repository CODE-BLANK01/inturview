"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

const CATEGORIES = [
  ["RECRUITER_SCREEN", "Recruiter screen"],
  ["BEHAVIORAL", "Behavioral"],
  ["TECHNICAL", "Technical deep-dive"],
  ["CODING", "Coding"],
  ["SYSTEM_DESIGN", "System design"],
] as const;
const LEVELS = ["junior", "mid", "senior"] as const;

export interface QuestionFormValue {
  category: (typeof CATEGORIES)[number][0];
  title: string;
  prompt: string;
  followUps: string[];
  signals: string[];
  levels: string[];
  roles: string[];
  tags: string[];
  difficulty: "Easy" | "Medium" | "Hard" | null;
  details: unknown;
}

const EMPTY: QuestionFormValue = {
  category: "BEHAVIORAL",
  title: "",
  prompt: "",
  followUps: [],
  signals: [],
  levels: [],
  roles: [],
  tags: [],
  difficulty: null,
  details: null,
};

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const commas = (s: string) => s.split(",").map((l) => l.trim().toLowerCase()).filter(Boolean);

export function QuestionForm({ questionId, initial }: { questionId?: string; initial?: QuestionFormValue }) {
  const router = useRouter();
  const start = initial ?? EMPTY;
  const [category, setCategory] = useState(start.category);
  const [title, setTitle] = useState(start.title);
  const [prompt, setPrompt] = useState(start.prompt);
  const [followUps, setFollowUps] = useState(start.followUps.join("\n"));
  const [signals, setSignals] = useState(start.signals.join("\n"));
  const [levels, setLevels] = useState<string[]>(start.levels);
  const [roles, setRoles] = useState(start.roles.join(", "));
  const [tags, setTags] = useState(start.tags.join(", "));
  const [difficulty, setDifficulty] = useState(start.difficulty ?? "");
  const [details, setDetails] = useState(start.details ? JSON.stringify(start.details, null, 2) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    let parsedDetails: unknown = null;
    if (details.trim()) {
      try {
        parsedDetails = JSON.parse(details);
      } catch {
        setError("Extra details must be valid JSON, or empty.");
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(questionId ? `/api/admin/questions/${questionId}` : "/api/admin/questions", {
        method: questionId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          title,
          prompt,
          followUps: lines(followUps),
          signals: lines(signals),
          levels,
          roles: commas(roles),
          tags: commas(tags),
          difficulty: difficulty || null,
          details: parsedDetails,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Save failed (${res.status})`);
      if (questionId) {
        setSaved(true);
        router.refresh();
      } else {
        router.push(`/admin/questions/${body.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 max-w-3xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Category</span>
          <select id="q-category" className="input" value={category} onChange={(e) => setCategory(e.target.value as QuestionFormValue["category"])}>
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Difficulty</span>
          <select id="q-difficulty" className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">Not rated</option>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Title</span>
        <input id="q-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Disagreeing with a manager" required />
      </label>

      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Question, as the interviewer asks it</span>
        <textarea id="q-prompt" className="input min-h-[110px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Follow-ups · one per line, deepest last</span>
          <textarea id="q-followups" className="input min-h-[140px] text-sm" value={followUps} onChange={(e) => setFollowUps(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-text-dim">What a strong answer shows · one per line</span>
          <textarea id="q-signals" className="input min-h-[140px] text-sm" value={signals} onChange={(e) => setSignals(e.target.value)} />
        </label>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-xs uppercase tracking-[0.08em] text-text-dim">Levels</legend>
        <div className="flex gap-4 text-sm">
          {LEVELS.map((l) => (
            <label key={l} className="inline-flex items-center gap-2">
              <input
                id={`q-level-${l}`}
                type="checkbox"
                checked={levels.includes(l)}
                onChange={(e) => setLevels((cur) => (e.target.checked ? [...cur, l] : cur.filter((x) => x !== l)))}
              />
              {l}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Roles · comma separated</span>
          <input id="q-roles" className="input" value={roles} onChange={(e) => setRoles(e.target.value)} placeholder="backend, data" />
        </label>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Tags · comma separated</span>
          <input id="q-tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="conflict, ownership" />
        </label>
      </div>

      <details className="panel p-3">
        <summary className="text-sm font-medium cursor-pointer">Extra details (JSON)</summary>
        <p className="text-xs text-text-dim mt-2">Coding examples and constraints, design requirements and so on. Leave empty if not needed.</p>
        <textarea id="q-details" className="input font-mono text-xs mt-2 min-h-[160px]" value={details} onChange={(e) => setDetails(e.target.value)} />
      </details>

      {error && <div className="panel border-hard/40 bg-hard/10 px-3 py-2 text-sm text-hard">{error}</div>}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {questionId ? "Save changes" : "Create draft"}
        </button>
        {saved && <span className="text-sm text-text-muted">Saved. Publish to make this version live.</span>}
      </div>
    </form>
  );
}
