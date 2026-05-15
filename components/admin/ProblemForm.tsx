"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, X, ArrowLeft, Save } from "lucide-react";
import { TOPICS } from "@/lib/problems";

type Difficulty = "Easy" | "Medium" | "Hard";

export interface ProblemFormValue {
  id: string;
  title: string;
  difficulty: Difficulty;
  topic: string;
  leetcodeUrl: string;
  description: string;
  examples: { input: string; output: string }[];
  constraints: string[];
  optimalTime: string;
  optimalSpace: string;
  tags: string[];
}

interface ProblemFormProps {
  mode: "create" | "edit";
  initial?: Partial<ProblemFormValue>;
  problemId?: string;
}

const EMPTY: ProblemFormValue = {
  id: "",
  title: "",
  difficulty: "Easy",
  topic: TOPICS[0]!,
  leetcodeUrl: "",
  description: "",
  examples: [{ input: "", output: "" }],
  constraints: [""],
  optimalTime: "",
  optimalSpace: "",
  tags: [],
};

export function ProblemForm({ mode, initial, problemId }: ProblemFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProblemFormValue>({ ...EMPTY, ...initial });
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(", "));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ProblemFormValue>(k: K, v: ProblemFormValue[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const constraints = form.constraints.map((c) => c.trim()).filter(Boolean);
    const examples = form.examples
      .map((ex) => ({ input: ex.input.trim(), output: ex.output.trim() }))
      .filter((ex) => ex.input || ex.output);

    const payload = {
      ...form,
      tags,
      constraints,
      examples,
    };

    try {
      const res =
        mode === "create"
          ? await fetch("/api/admin/problems", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/admin/problems/${problemId}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                title: payload.title,
                difficulty: payload.difficulty,
                topic: payload.topic,
                leetcodeUrl: payload.leetcodeUrl,
                description: payload.description,
                examples: payload.examples,
                constraints: payload.constraints,
                optimalTime: payload.optimalTime,
                optimalSpace: payload.optimalSpace,
                tags: payload.tags,
              }),
            });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      router.push("/admin/problems");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/problems"
          className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {mode === "create" ? "Create problem" : "Save changes"}
        </button>
      </div>

      {error && (
        <div className="panel border-hard/40 bg-hard/10 px-3 py-2 text-sm text-hard">
          {error}
        </div>
      )}

      <Section title="Identity">
        <Field
          label="Slug (URL id)"
          hint={`Lowercase, hyphens. e.g. "two-sum". Can't be changed after creation.`}
        >
          <input
            className="input font-mono"
            value={form.id}
            onChange={(e) => set("id", e.target.value)}
            placeholder="two-sum"
            disabled={mode === "edit"}
            required
            maxLength={80}
          />
        </Field>
        <Field label="Title">
          <input
            className="input"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Two Sum"
            required
            maxLength={200}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Difficulty">
            <select
              className="input"
              value={form.difficulty}
              onChange={(e) => set("difficulty", e.target.value as Difficulty)}
            >
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </Field>
          <Field label="Topic">
            <select
              className="input"
              value={form.topic}
              onChange={(e) => set("topic", e.target.value)}
            >
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="LeetCode URL" hint="Optional but recommended.">
          <input
            className="input"
            value={form.leetcodeUrl}
            onChange={(e) => set("leetcodeUrl", e.target.value)}
            placeholder="https://leetcode.com/problems/..."
          />
        </Field>
      </Section>

      <Section title="Statement">
        <Field label="Description">
          <textarea
            className="input font-sans"
            rows={6}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            required
            maxLength={8000}
          />
        </Field>
      </Section>

      <Section title="Examples">
        <div className="space-y-3">
          {form.examples.map((ex, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                className="input font-mono text-xs"
                placeholder='nums = [2,7,11,15], target = 9'
                value={ex.input}
                onChange={(e) =>
                  set(
                    "examples",
                    form.examples.map((x, idx) =>
                      idx === i ? { ...x, input: e.target.value } : x
                    )
                  )
                }
              />
              <input
                className="input font-mono text-xs"
                placeholder="[0,1]"
                value={ex.output}
                onChange={(e) =>
                  set(
                    "examples",
                    form.examples.map((x, idx) =>
                      idx === i ? { ...x, output: e.target.value } : x
                    )
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  set("examples", form.examples.filter((_, idx) => idx !== i))
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg-surface text-text-muted hover:text-hard hover:border-hard/40"
                title="Remove example"
                disabled={form.examples.length <= 1}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              set("examples", [...form.examples, { input: "", output: "" }])
            }
            className="btn text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Add example
          </button>
        </div>
      </Section>

      <Section title="Constraints">
        <div className="space-y-2">
          {form.constraints.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2">
              <input
                className="input font-mono text-xs"
                placeholder="2 <= nums.length <= 10^4"
                value={c}
                onChange={(e) =>
                  set(
                    "constraints",
                    form.constraints.map((x, idx) => (idx === i ? e.target.value : x))
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  set(
                    "constraints",
                    form.constraints.filter((_, idx) => idx !== i)
                  )
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg-surface text-text-muted hover:text-hard hover:border-hard/40"
                disabled={form.constraints.length <= 1}
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set("constraints", [...form.constraints, ""])}
            className="btn text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Add constraint
          </button>
        </div>
      </Section>

      <Section title="Complexity & tags">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Optimal time">
            <input
              className="input font-mono"
              value={form.optimalTime}
              onChange={(e) => set("optimalTime", e.target.value)}
              placeholder="O(n)"
              required
            />
          </Field>
          <Field label="Optimal space">
            <input
              className="input font-mono"
              value={form.optimalSpace}
              onChange={(e) => set("optimalSpace", e.target.value)}
              placeholder="O(n)"
              required
            />
          </Field>
        </div>
        <Field label="Tags" hint="Comma-separated. e.g. hash map, array">
          <input
            className="input"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="hash map, array"
          />
        </Field>
      </Section>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-5 space-y-4">
      <h2 className="text-xs uppercase tracking-[0.08em] text-text-dim">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-text-dim">{hint}</span>}
    </label>
  );
}
