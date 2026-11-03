"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import {
  LoopInputSchema,
  LOOP_MODE_LABELS,
  quotaMessage,
  type LoopInput,
  type LoopRound,
} from "@/lib/loop";
import { useLoopRepository } from "./LoopProvider";
import { Spinner } from "@/components/ui/Spinner";
import { TypingDots } from "@/components/ui/TypingDots";

export function LoopNew() {
  const { repository, quotas } = useLoopRepository();
  const router = useRouter();
  const [input, setInput] = useState<LoopInput>({
    jobPost: "",
    resume: "",
    interviewDate: "",
  });
  const [rounds, setRounds] = useState<LoopRound[]>([]);
  const [state, setState] = useState<"idle" | "generating" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const d = new Date();
    setToday(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
    return () => controller.current?.abort();
  }, []);
  const change = (name: keyof LoopInput, value: string) => {
    setInput((current) => ({ ...current, [name]: value }));
    setRounds([]);
    setError(null);
  };
  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = LoopInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }
    if (input.interviewDate < today) {
      setError("Choose today or a future interview date.");
      return;
    }
    controller.current?.abort();
    controller.current = new AbortController();
    setState("generating");
    setError(null);
    setRounds([]);
    try {
      for await (const round of repository.generate(
        parsed.data,
        controller.current.signal,
      ))
        setRounds((current) => [...current, round]);
    } catch {
      setError("The sample plan could not be created. Please try again.");
    } finally {
      setState("idle");
    }
  };
  const move = (index: number, delta: number) =>
    setRounds((current) => {
      const copy = [...current];
      const target = index + delta;
      if (target < 0 || target >= copy.length) return current;
      [copy[index], copy[target]] = [copy[target]!, copy[index]!];
      return copy;
    });
  const confirm = async () => {
    setState("saving");
    setError(null);
    try {
      const loop = await repository.create(input, rounds);
      router.push(`/loop/${loop.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The plan could not be saved.");
      setState("idle");
    }
  };
  return (
    <>
      <header className="loop-heading">
        <p className="t-eyebrow">The Loop / New plan</p>
        <h1>Practice for a particular opportunity.</h1>
        <p>A role. Your experience. A date to work toward.</p>
      </header>
      <div className="loop-builder">
        <form onSubmit={generate} className="loop-panel">
          <label htmlFor="loop-job">The job post</label>
          <textarea
            id="loop-job"
            value={input.jobPost}
            onChange={(e) => change("jobPost", e.target.value)}
            rows={7}
            required
            minLength={40}
            maxLength={20000}
            disabled={state !== "idle"}
            placeholder="Role title, responsibilities, and what the team is looking for…"
          />
          <label htmlFor="loop-resume">Your résumé or experience</label>
          <textarea
            id="loop-resume"
            value={input.resume}
            onChange={(e) => change("resume", e.target.value)}
            rows={6}
            required
            minLength={40}
            maxLength={20000}
            disabled={state !== "idle"}
            placeholder="Paste your experience, projects, and the work you want to talk about."
          />
          <label htmlFor="loop-date">Your interview date</label>
          <input
            id="loop-date"
            type="date"
            value={input.interviewDate}
            onChange={(e) => change("interviewDate", e.target.value)}
            min={today}
            required
            disabled={state !== "idle"}
          />
          <p className="loop-help">
            This prototype selects from template rounds. It does not analyze
            your résumé with AI. Pasted documents are not saved or sent to a
            server.
          </p>
          <button className="btn btn-primary" disabled={state !== "idle"}>
            {state === "generating" ? (
              <>
                <Spinner /> Building sample plan…
              </>
            ) : (
              "Generate sample plan"
            )}
          </button>
        </form>
        <section className="loop-panel" aria-labelledby="loop-plan-heading">
          <h2 id="loop-plan-heading">Your round plan</h2>
          <p className="loop-help">
            Reorder or remove rounds before confirming. Each completed round
            unlocks the next.
          </p>
          <div role="status" className="sr-only">
            {rounds.length} rounds in your plan.
          </div>
          {!rounds.length && state === "idle" && (
            <div className="loop-empty">
              Your plan will appear here. Start with the job post and the
              experience you want to bring into the room.
            </div>
          )}
          <ol className="loop-plan-list">
            {rounds.map((round, index) => (
              <li key={round.id}>
                <div>
                  <span className="t-eyebrow">
                    {String(index + 1).padStart(2, "0")} /{" "}
                    {LOOP_MODE_LABELS[round.mode]}
                  </span>
                  <h3>{round.title}</h3>
                  <p>{round.focus}</p>
                  {quotaMessage(round.mode, quotas) && (
                    <p className="loop-quota-note">
                      Your current practice limit applies to this round.
                    </p>
                  )}
                </div>
                <div className="loop-order-actions">
                  <button
                    type="button"
                    aria-label={`Move ${round.title} up`}
                    disabled={index === 0 || state !== "idle"}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${round.title} down`}
                    disabled={index === rounds.length - 1 || state !== "idle"}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${round.title}`}
                    disabled={state !== "idle"}
                    onClick={() =>
                      setRounds((current) =>
                        current.filter((item) => item.id !== round.id),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {state === "generating" ? (
            <div className="loop-stream-status">
              <TypingDots />
              <button
                className="btn btn-ghost"
                onClick={() => controller.current?.abort()}
              >
                Stop generating
              </button>
            </div>
          ) : (
            rounds.length > 0 && (
              <button
                className="btn btn-primary"
                disabled={state === "saving"}
                onClick={confirm}
              >
                {state === "saving" ? "Saving plan…" : "Confirm my loop"}
              </button>
            )
          )}
        </section>
      </div>
      {error && (
        <p className="loop-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
