"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { AccountProfile } from "./AccountPage";

type Goal = "PRACTICING" | "RECRUITING" | "COACHING" | "EXPLORING";

const GOAL_LABELS: Record<Goal, string> = {
  PRACTICING: "Practicing for interviews",
  RECRUITING: "Hiring & evaluating candidates",
  COACHING: "Coaching others",
  EXPLORING: "Just exploring",
};

export function ProfileSection({ profile }: { profile: AccountProfile }) {
  const [name, setName] = useState(profile.name ?? "");
  const [goal, setGoal] = useState<Goal | "">((profile.goal as Goal | null) ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name !== (profile.name ?? "") || goal !== (profile.goal ?? "");

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          goal: (goal as Goal) || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <SectionHeader
        eyebrow="Profile"
        title="How you show up."
        sub="Used in the dashboard greeting and across the app."
      />

      <div className="panel p-6 space-y-5">
        <ReadOnlyField label="Email" value={profile.email} hint="Read-only. Email change is coming soon." />
        <ReadOnlyField
          label="Member since"
          value={new Date(profile.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        />

        <label className="block">
          <span className="t-eyebrow">Display name</span>
          <input
            className="input mt-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            maxLength={80}
          />
        </label>

        <div>
          <span className="t-eyebrow">What brings you here?</span>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGoal(g)}
                className={`text-left rounded-md p-3 border transition-colors duration-150 ${
                  goal === g
                    ? "border-text bg-bg-inset/40"
                    : "border-border hover:border-border-strong hover:bg-bg-inset/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm ${
                      goal === g ? "text-text font-medium" : "text-text-muted"
                    }`}
                  >
                    {GOAL_LABELS[g]}
                  </span>
                  {goal === g && (
                    <Check
                      className="h-3.5 w-3.5"
                      style={{ color: "rgb(var(--text-ember))" }}
                      aria-hidden
                    />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-hard/40 bg-hard-bg/30 text-hard text-sm px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          {saved && (
            <span
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: "rgb(var(--score-hire))" }}
            >
              <Check className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="btn btn-primary"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </section>
  );
}

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <span className="t-eyebrow">{label}</span>
      <p className="mt-1.5 text-[15px] text-text">{value}</p>
      {hint && <p className="text-xs text-text-dim mt-1">{hint}</p>}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <header className="mb-4">
      <p className="t-eyebrow mb-1.5">{eyebrow}</p>
      <h2 className="t-section-headline text-xl">{title}</h2>
      {sub && (
        <p className="t-body-light text-text-muted mt-1 text-sm max-w-xl">{sub}</p>
      )}
    </header>
  );
}
