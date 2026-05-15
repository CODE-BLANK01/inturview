"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Search } from "lucide-react";
import { PROBLEMS, TOPICS } from "@/lib/problems";
import { DifficultyBadge, TopicBadge } from "./Badges";
import type { Difficulty } from "@/lib/types";

const DIFFICULTIES: ("All" | Difficulty)[] = ["All", "Easy", "Medium", "Hard"];

interface ProblemStat {
  attempts: number;
  lastScore: number | null;
  lastRecommendation: string | null;
  lastAt: string | null;
}

export function ProblemBrowser() {
  const [topic, setTopic] = useState<string>("All");
  const [difficulty, setDifficulty] = useState<"All" | Difficulty>("All");
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState<Record<string, ProblemStat>>({});

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/interviews/stats", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.stats) setStats(j.stats as Record<string, ProblemStat>);
      })
      .catch(() => {
        /* signed out or network error — leave empty */
      });
    return () => ac.abort();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROBLEMS.filter((p) => {
      if (topic !== "All" && p.topic !== topic) return false;
      if (difficulty !== "All" && p.difficulty !== difficulty) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [topic, difficulty, query]);

  const topicsWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of PROBLEMS) counts[p.topic] = (counts[p.topic] ?? 0) + 1;
    return TOPICS.filter((t) => counts[t] > 0).map((t) => ({ name: t, count: counts[t] }));
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      <aside className="space-y-4">
        <section className="panel p-4">
          <h3 className="text-xs uppercase tracking-wide text-text-dim mb-3">Topics</h3>
          <ul className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
            <TopicItem
              label="All topics"
              count={PROBLEMS.length}
              active={topic === "All"}
              onClick={() => setTopic("All")}
            />
            {topicsWithCounts.map((t) => (
              <TopicItem
                key={t.name}
                label={t.name}
                count={t.count}
                active={topic === t.name}
                onClick={() => setTopic(t.name)}
              />
            ))}
          </ul>
        </section>

        <section className="panel p-4">
          <h3 className="text-xs uppercase tracking-wide text-text-dim mb-3">Difficulty</h3>
          <div className="flex flex-wrap gap-1.5">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`badge cursor-pointer ${
                  difficulty === d
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border text-text-muted hover:border-border-strong"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section>
        <div className="mb-4 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            className="input pl-9"
            placeholder="Search problems by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="panel divide-y divide-border overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-text-dim text-sm">
              No problems match those filters.
            </div>
          ) : (
            filtered.map((p) => {
              const stat = stats[p.id];
              return (
                <Link
                  key={p.id}
                  href={`/interview/${p.id}`}
                  className="flex items-center gap-3 p-3 hover:bg-bg-surface transition-colors"
                >
                  <div className="w-5 shrink-0">
                    {stat ? (
                      <Check className="h-5 w-5 text-easy" aria-label="Completed" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{p.title}</span>
                      {stat && stat.lastScore !== null && (
                        <span className="text-xs text-text-dim">
                          best/latest {stat.lastScore}/25 · {stat.attempts}{" "}
                          {stat.attempts === 1 ? "attempt" : "attempts"}
                        </span>
                      )}
                    </div>
                  </div>
                  <DifficultyBadge value={p.difficulty} />
                  <div className="hidden sm:block">
                    <TopicBadge value={p.topic} />
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <p className="mt-3 text-xs text-text-dim">
          Showing {filtered.length} of {PROBLEMS.length} problems.
        </p>
      </section>
    </div>
  );
}

function TopicItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between transition-colors ${
          active
            ? "bg-accent/15 text-accent"
            : "text-text-muted hover:text-text hover:bg-bg-surface"
        }`}
      >
        <span className="truncate">{label}</span>
        <span className="text-xs text-text-dim tabular-nums">{count}</span>
      </button>
    </li>
  );
}
