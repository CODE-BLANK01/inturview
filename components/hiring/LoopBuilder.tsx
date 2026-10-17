"use client";

import { useHiringPaths } from "./HiringPaths";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import type { LoopRoundConfig } from "@/lib/loopTemplates";
import { estimateLoopCost, totalMinutes, type LiveRates } from "@/lib/loopEstimate";
import { diffLoop, type LoopShape } from "@/lib/loopDiff";

type Category = LoopRoundConfig["category"];
const CATEGORIES: [Category, string][] = [
  ["RECRUITER_SCREEN", "Recruiter screen"],
  ["BEHAVIORAL", "Behavioral"],
  ["TECHNICAL", "Technical deep-dive"],
  ["CODING", "Coding"],
  ["SYSTEM_DESIGN", "System design"],
];
const LABEL = Object.fromEntries(CATEGORIES) as Record<Category, string>;
const DURATIONS = [10, 15, 20, 25, 30, 45, 60, 90];

export interface LoopBuilderProps {
  loopId: string;
  initial: {
    name: string;
    description: string | null;
    roleTarget: string | null;
    level: "junior" | "mid" | "senior" | null;
    rounds: LoopRoundConfig[];
  };
  questionTitles: Record<string, string>;
  rates: LiveRates;
  initialProblems: string[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: number;
  /** The revision this editor loaded; every save and status change sends it. */
  revision: number;
  /** The latest published version, to show what publishing would change. */
  published: LoopShape | null;
}

const newRound = (category: Category = "BEHAVIORAL"): LoopRoundConfig => ({
  id: Math.random().toString(36).slice(2, 10),
  category,
  title: LABEL[category],
  durationMinutes: 20,
  candidateBrief: "",
  questions: { mode: "pool", count: 2, tags: [], roles: [], level: null },
});

const commas = (s: string) => s.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

export function LoopBuilder(props: LoopBuilderProps) {
  const paths = useHiringPaths();
  const router = useRouter();
  const [name, setName] = useState(props.initial.name);
  const [description, setDescription] = useState(props.initial.description ?? "");
  const [roleTarget, setRoleTarget] = useState(props.initial.roleTarget ?? "");
  const [level, setLevel] = useState(props.initial.level ?? "");
  const [rounds, setRounds] = useState<LoopRoundConfig[]>(props.initial.rounds);
  const [titles, setTitles] = useState(props.questionTitles);
  const [problems, setProblems] = useState(props.initialProblems);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | "archive" | "restore" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [revision, setRevisionState] = useState(props.revision);
  // Preview runs right after a save; it needs the revision the save returned, not the stale render's.
  const revisionRef = useRef(props.revision);
  const setRevision = (r: number) => {
    revisionRef.current = r;
    setRevisionState(r);
  };
  /** Someone else changed the loop; saving would overwrite them, so only reloading is offered. */
  const [conflict, setConflict] = useState(false);

  /** Bumped on every edit. A save only clears "unsaved" if nothing changed while it was in flight. */
  const editGeneration = useRef(0);
  const touch = () => {
    editGeneration.current += 1;
    setDirty(true);
    setMessage(null);
  };
  const update = (i: number, patch: Partial<LoopRoundConfig>) => {
    setRounds((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    touch();
  };
  const move = (i: number, by: -1 | 1) => {
    setRounds((rs) => {
      const next = [...rs];
      const [r] = next.splice(i, 1);
      next.splice(i + by, 0, r!);
      return next;
    });
    touch();
  };

  const estimate = useMemo(() => estimateLoopCost(rounds, props.rates), [rounds, props.rates]);
  const minutes = totalMinutes(rounds);

  const save = async () => {
    const savingGeneration = editGeneration.current;
    setBusy("save");
    setMessage(null);
    try {
      const res = await fetch(`${paths.api}/loops/${props.loopId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          roleTarget: roleTarget || null,
          level: level || null,
          rounds,
          revision: revisionRef.current,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.conflict) setConflict(true);
      if (!res.ok) throw new Error(body.error || `Save failed (${res.status})`);
      setRevision(body.revision);
      setProblems(body.problems ?? []);
      // Edits made while this save was in flight weren't in it: they stay unsaved.
      const caughtUp = editGeneration.current === savingGeneration;
      setDirty(!caughtUp);
      setMessage({ tone: "ok", text: caughtUp ? "Saved." : "Saved. You've made more changes since." });
      router.refresh();
      return true;
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Save failed" });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const [previewing, setPreviewing] = useState(false);
  const changes = useMemo(
    () => diffLoop(props.published, { name, description: description || null, roleTarget: roleTarget || null, level: level || null, rounds }),
    [props.published, name, description, roleTarget, level, rounds],
  );

  /** Saves if needed, then opens the draft as a candidate would see it, in a new tab. */
  const preview = async () => {
    if (dirty && !(await save())) return;
    // Open the tab now, while we still have the click; pop-up blockers allow that.
    const tab = window.open("about:blank", "_blank");
    setPreviewing(true);
    setMessage(null);
    const res = await fetch(`${paths.api}/loops/${props.loopId}/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision: revisionRef.current }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    setPreviewing(false);
    if (body?.conflict) setConflict(true);
    if (!res?.ok || !body?.link) {
      tab?.close();
      if (body?.problems) setProblems(body.problems);
      return setMessage({ tone: "error", text: body?.error ?? "Couldn't open a preview." });
    }
    if (tab) tab.location.href = body.link;
    else window.location.href = body.link;
  };

  const status = async (action: "publish" | "archive" | "restore") => {
    if (action === "publish" && dirty && !(await save())) return;
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(`${paths.api}/loops/${props.loopId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // The ref, not the render's value: publish right after a save must send the revision that save returned.
        body: JSON.stringify({ action, revision: revisionRef.current }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.conflict) setConflict(true);
      if (!res.ok) {
        if (body.problems) setProblems(body.problems);
        throw new Error(body.error || `Failed (${res.status})`);
      }
      setRevision(body.revision);
      setMessage({ tone: "ok", text: action === "publish" ? `Published as version ${body.version}.` : action === "archive" ? "Archived." : "Restored." });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
      <div className="space-y-6 min-w-0">
        <section className="panel p-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Loop name</span>
            <input id="loop-name" className="input" value={name} onChange={(e) => { setName(e.target.value); touch(); }} />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Role</span>
              <input id="loop-role" className="input" value={roleTarget} onChange={(e) => { setRoleTarget(e.target.value); touch(); }} placeholder="Backend engineer" />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Level</span>
              <select id="loop-level" className="input" value={level} onChange={(e) => { setLevel(e.target.value); touch(); }}>
                <option value="">Any</option>
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-text-dim">What candidates are told about this loop</span>
            <textarea id="loop-description" className="input min-h-[70px] text-sm" value={description} onChange={(e) => { setDescription(e.target.value); touch(); }} />
          </label>
        </section>

        <ol className="space-y-4">
          {rounds.map((r, i) => (
            <RoundEditor
              key={r.id}
              index={i}
              total={rounds.length}
              round={r}
              titles={titles}
              onTitle={(id, t) => setTitles((cur) => ({ ...cur, [id]: t }))}
              onChange={(patch) => update(i, patch)}
              onMove={(by) => move(i, by)}
              onRemove={() => { setRounds((rs) => rs.filter((_, j) => j !== i)); touch(); }}
              costUsd={estimate.perRound[i]?.usd ?? 0}
            />
          ))}
        </ol>

        <button type="button" className="btn text-sm" onClick={() => { setRounds((rs) => [...rs, newRound()]); touch(); }} disabled={rounds.length >= 8}>
          <Plus className="h-4 w-4" /> Add round
        </button>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <div className="panel p-4 space-y-3">
          <h2 className="text-sm font-medium">Candidate journey</h2>
          {rounds.length === 0 ? (
            <p className="text-sm text-text-dim">No rounds yet.</p>
          ) : (
            <ol className="space-y-2">
              {rounds.map((r, i) => (
                <li key={r.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate"><span className="text-text-dim tabular-nums">{i + 1}.</span> {r.title || LABEL[r.category]}</span>
                  <span className="text-text-dim tabular-nums whitespace-nowrap">{r.durationMinutes} min</span>
                </li>
              ))}
            </ol>
          )}
          <dl className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
            <div><dt className="text-xs text-text-dim">Total time</dt><dd className="font-semibold tabular-nums">{Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ""}{minutes % 60} min</dd></div>
            <div><dt className="text-xs text-text-dim">Est. cost / candidate</dt><dd className="font-semibold tabular-nums">${estimate.totalUsd.toFixed(2)}</dd></div>
          </dl>
          <p className="text-xs text-text-dim">Estimate: the AI interviewer&apos;s text chat per minute, plus scoring each round. Rough, for planning.</p>
        </div>

        <div className="panel p-4 space-y-3">
          <p className="text-sm">
            {props.status === "PUBLISHED" && <>Live as <strong>version {props.version}</strong>.</>}
            {props.status === "DRAFT" && "Draft. Not available for invites yet."}
            {props.status === "ARCHIVED" && "Archived. Existing invites keep working; it can't be used for new ones."}
          </p>
          {props.status !== "ARCHIVED" && (
            <div className="text-sm">
              <p className="font-medium">{props.published ? `Changes since version ${props.version}` : "Publishing creates version 1"}</p>
              {props.published && changes.length === 0 ? (
                <p className="text-text-dim">None. Publishing again changes nothing.</p>
              ) : props.published ? (
                <ul className="mt-1 space-y-1 text-text-muted list-disc pl-4">
                  {changes.map((c) => <li key={c}>{c}</li>)}
                </ul>
              ) : null}
            </div>
          )}
          {problems.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">Before you can publish:</p>
              <ul className="mt-1 space-y-1 text-text-muted list-disc pl-4">
                {problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn text-sm" onClick={preview} disabled={!!busy || previewing || conflict}>
              {previewing && <Loader2 className="h-4 w-4 animate-spin" />} Preview as candidate
            </button>
            <button type="button" className="btn text-sm" onClick={save} disabled={!!busy || !dirty || conflict}>
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </button>
            {props.status !== "ARCHIVED" && (
              <button type="button" className="btn btn-primary text-sm" onClick={() => status("publish")} disabled={!!busy || conflict}>
                {busy === "publish" && <Loader2 className="h-4 w-4 animate-spin" />}
                {props.version === 0 ? "Publish" : "Publish changes"}
              </button>
            )}
            <button type="button" className="btn text-sm" onClick={() => status(props.status === "ARCHIVED" ? "restore" : "archive")} disabled={!!busy || conflict}>
              {props.status === "ARCHIVED" ? "Restore" : "Archive"}
            </button>
          </div>
          {dirty && <p className="text-xs text-text-dim">Unsaved changes.</p>}
          {message && <p className={`text-sm ${message.tone === "error" ? "text-hard" : "text-text-muted"}`} role="status">{message.text}</p>}
          {conflict && (
            <button type="button" className="btn btn-primary text-sm w-full justify-center" onClick={() => window.location.reload()}>
              Reload the latest version{dirty ? " (your unsaved edits will be lost)" : ""}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function RoundEditor({
  index, total, round, titles, onTitle, onChange, onMove, onRemove, costUsd,
}: {
  index: number;
  total: number;
  round: LoopRoundConfig;
  titles: Record<string, string>;
  onTitle: (id: string, title: string) => void;
  onChange: (patch: Partial<LoopRoundConfig>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  costUsd: number;
}) {
  const q = round.questions;
  return (
    <li className="panel p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Round {index + 1} · ${costUsd.toFixed(2)}</span>
        <div className="flex gap-1">
          <IconButton label="Move up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></IconButton>
          <IconButton label="Move down" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></IconButton>
          <IconButton label="Remove round" onClick={onRemove}><Trash2 className="h-4 w-4" /></IconButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px] gap-3">
        <label className="space-y-1">
          <span className="text-xs text-text-dim">Category</span>
          <select
            id={`r-${round.id}-category`}
            className="input"
            value={round.category}
            onChange={(e) => {
              const category = e.target.value as Category;
              // Fixed questions belong to one category, so changing it clears them.
              onChange({
                category,
                title: round.title === LABEL[round.category] ? LABEL[category] : round.title,
                questions: q.mode === "fixed" ? { mode: "fixed", questionIds: [] } : q,
              });
            }}
          >
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-text-dim">Title</span>
          <input id={`r-${round.id}-title`} className="input" value={round.title} onChange={(e) => onChange({ title: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-text-dim">Length</span>
          <select id={`r-${round.id}-duration`} className="input" value={round.durationMinutes} onChange={(e) => onChange({ durationMinutes: Number(e.target.value) })}>
            {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs text-text-dim">Questions</legend>
        <div className="flex gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input id={`r-${round.id}-pool`} type="radio" checked={q.mode === "pool"} onChange={() => onChange({ questions: { mode: "pool", count: 2, tags: [], roles: [], level: null } })} />
            Pick from a pool (different for each candidate)
          </label>
          <label className="inline-flex items-center gap-2">
            <input id={`r-${round.id}-fixed`} type="radio" checked={q.mode === "fixed"} onChange={() => onChange({ questions: { mode: "fixed", questionIds: [] } })} />
            Specific questions
          </label>
        </div>
        {q.mode === "pool" ? (
          <PoolEditor round={round} onChange={onChange} />
        ) : (
          <FixedEditor round={round} titles={titles} onTitle={onTitle} onChange={onChange} />
        )}
      </fieldset>

      <label className="block space-y-1">
        <span className="text-xs text-text-dim">What the candidate is told before this round (optional)</span>
        <input id={`r-${round.id}-brief`} className="input text-sm" value={round.candidateBrief} onChange={(e) => onChange({ candidateBrief: e.target.value })} placeholder={`e.g. A ${round.durationMinutes}-minute ${LABEL[round.category].toLowerCase()} conversation. No preparation needed.`} />
      </label>
    </li>
  );
}

function PoolEditor({ round, onChange }: { round: LoopRoundConfig; onChange: (p: Partial<LoopRoundConfig>) => void }) {
  const paths = useHiringPaths();
  const q = round.questions as Extract<LoopRoundConfig["questions"], { mode: "pool" }>;
  const [tags, setTags] = useState(q.tags.join(", "));
  const [roles, setRoles] = useState(q.roles.join(", "));
  const [pool, setPool] = useState<{ count: number; sample: string[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch(`${paths.api}/loops/pool`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: round.category, tags: q.tags, roles: q.roles, level: q.level }),
      }).catch(() => null);
      if (res?.ok) setPool(await res.json());
    }, 350);
    return () => clearTimeout(timer.current);
  }, [paths.api, round.category, q.tags, q.roles, q.level]);

  const set = (patch: Partial<typeof q>) => onChange({ questions: { ...q, ...patch } });
  const short = pool !== null && pool.count < q.count;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr_120px] gap-3">
        <label className="space-y-1">
          <span className="text-xs text-text-dim">How many</span>
          <select id={`r-${round.id}-count`} className="input" value={q.count} onChange={(e) => set({ count: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-text-dim">With all of these tags</span>
          <input id={`r-${round.id}-tags`} className="input" value={tags} onChange={(e) => setTags(e.target.value)} onBlur={() => set({ tags: commas(tags) })} placeholder="any" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-text-dim">For any of these roles</span>
          <input id={`r-${round.id}-roles`} className="input" value={roles} onChange={(e) => setRoles(e.target.value)} onBlur={() => set({ roles: commas(roles) })} placeholder="any" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-text-dim">Level</span>
          <select id={`r-${round.id}-level`} className="input" value={q.level ?? ""} onChange={(e) => set({ level: (e.target.value || null) as typeof q.level })}>
            <option value="">Any</option>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </select>
        </label>
      </div>
      {pool && (
        <p className={`text-sm ${short ? "text-hard" : "text-text-muted"}`}>
          {pool.count} published question{pool.count === 1 ? "" : "s"} match{pool.count === 1 ? "es" : ""}
          {short ? ` — not enough for ${q.count}.` : "."}
          {pool.sample.length > 0 && <span className="text-text-dim"> e.g. {pool.sample.slice(0, 3).join(" · ")}</span>}
        </p>
      )}
    </div>
  );
}

function FixedEditor({
  round, titles, onTitle, onChange,
}: {
  round: LoopRoundConfig;
  titles: Record<string, string>;
  onTitle: (id: string, title: string) => void;
  onChange: (p: Partial<LoopRoundConfig>) => void;
}) {
  const paths = useHiringPaths();
  const q = round.questions as Extract<LoopRoundConfig["questions"], { mode: "fixed" }>;
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const params = new URLSearchParams({ usable: "1", status: "PUBLISHED", category: round.category, ...(search.trim() && { q: search.trim() }) });
      const res = await fetch(`${paths.api}/questions?${params}`).catch(() => null);
      if (res?.ok) setResults(((await res.json()).questions as { id: string; title: string }[]).slice(0, 8));
    }, 300);
    return () => clearTimeout(timer.current);
  }, [paths.api, search, round.category]);

  const ids = q.questionIds;
  return (
    <div className="space-y-2">
      {ids.length > 0 && (
        <ol className="space-y-1">
          {ids.map((id, i) => (
            <li key={id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
              <span className="min-w-0 truncate"><span className="text-text-dim tabular-nums">{i + 1}.</span> {titles[id] ?? "Unknown question"}</span>
              <IconButton label="Remove question" onClick={() => onChange({ questions: { mode: "fixed", questionIds: ids.filter((x) => x !== id) } })}><X className="h-4 w-4" /></IconButton>
            </li>
          ))}
        </ol>
      )}
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" aria-hidden="true" />
        <input id={`r-${round.id}-search`} className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search published ${LABEL[round.category].toLowerCase()} questions`} />
      </div>
      <ul className="space-y-1">
        {results.filter((r) => !ids.includes(r.id)).slice(0, 5).map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className="w-full text-left text-sm px-3 py-1.5 rounded-md hover:bg-bg-inset inline-flex items-center gap-2"
              onClick={() => { onTitle(r.id, r.title); onChange({ questions: { mode: "fixed", questionIds: [...ids, r.id] } }); }}
            >
              <Plus className="h-3.5 w-3.5 text-text-dim" /> {r.title}
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="text-sm text-text-dim px-3">No published questions in this category match.</li>}
      </ul>
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-muted hover:text-text disabled:opacity-40"
    >
      {children}
    </button>
  );
}
