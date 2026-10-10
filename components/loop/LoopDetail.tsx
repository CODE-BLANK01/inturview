"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock, Check, Quote } from "lucide-react";
import { useLoopRepository } from "./LoopProvider";
import {
  beginLoopRound,
  completeLoopRound,
  consistencyFindings,
  LOOP_MODE_LABELS,
  quotaMessage,
  type InterviewLoop,
  type LoopMode,
} from "@/lib/loop";
import { ChatPanel } from "@/components/ChatPanel";
import { PhaseIndicator } from "@/components/PhaseIndicator";
import { DebriefView } from "@/components/DebriefView";
import { TopicBadge } from "@/components/Badges";
import { Timer } from "@/components/Timer";
import { LoopLoading } from "./LoopLoading";
import type { ChatMessage, Debrief } from "@/lib/types";

const questions: Record<LoopMode, string> = {
  recruiter:
    "What connects your experience to this role? Tell me about something you built and your part in it.",
  behavioral:
    "Describe a difficult decision on a project. Who was involved, what did you own, and what changed?",
  coding:
    "How would you find duplicate values in a large array? Explain your approach and the trade-offs before writing code.",
  design:
    "How would you design a notification service? Start with the requirements and walk through your first trade-off.",
};
const sampleDebrief: Debrief = {
  overall_recommendation: "Lean Hire",
  total_score: 18,
  max_score: 25,
  interviewer_summary:
    "Illustrative scorecard only. This shows the shape of a combined review; your answers have not been evaluated by AI.",
  strengths: [
    "Make each example specific to the role.",
    "Carry the same project context across rounds.",
  ],
  improvements: [
    "Distinguish personal ownership from shared outcomes.",
    "Explain the evidence behind each decision.",
  ],
  optimal_solution_notes:
    "Revisit one example and make your individual contribution explicit. This sample feedback is not generated from your answers.",
  scores: {
    problem_understanding: {
      score: 4,
      max: 5,
      evidence: "Example dimension — not evaluated.",
    },
    approach_quality: {
      score: 4,
      max: 5,
      evidence: "Example dimension — not evaluated.",
    },
    code_correctness: {
      score: 3,
      max: 5,
      evidence: "Example dimension — not evaluated.",
    },
    complexity_awareness: {
      score: 3,
      max: 5,
      evidence: "Example dimension — not evaluated.",
    },
    communication: {
      score: 4,
      max: 5,
      evidence: "Example dimension — not evaluated.",
    },
  },
};

export function LoopDetail({
  id,
  debrief = false,
}: {
  id: string;
  debrief?: boolean;
}) {
  const { repository, quotas } = useLoopRepository();
  const [loop, setLoop] = useState<InterviewLoop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ChatMessage[]>([]);
  const [today, setToday] = useState("");
  useEffect(() => {
    let alive = true;
    setLoading(true);
    repository
      .get(id)
      .then((value) => {
        if (alive) setLoop(value);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    const d = new Date();
    setToday(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
    return () => {
      alive = false;
    };
  }, [repository, id]);
  const save = async (next: InterviewLoop) => {
    setSaving(true);
    setError(null);
    try {
      await repository.save(next);
      setLoop(next);
      setDraft([]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Your draft could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (loading) return <LoopLoading />;
  if (!loop)
    return (
      <section className="loop-panel">
        <h1>That preview is not in this tab.</h1>
        <p>
          {error ||
            "Loop previews are stored in the tab where they were created. Start a new preview to try the workflow."}
        </p>
        <Link href="/loop/new" className="btn btn-primary">
          Create a new loop
        </Link>
      </section>
    );
  const active = loop.rounds.find((round) => round.status === "in_progress");
  const next =
    active ?? loop.rounds.find((round) => round.status === "available");
  const finished = loop.rounds.every((round) => round.status === "complete");
  const days = today
    ? Math.round(
        (Date.parse(loop.interviewDate) - Date.parse(today)) / 86400000,
      )
    : null;
  const blocked = next ? quotaMessage(next.mode, quotas) : null;
  const lastNote = loop.notes.at(-1);
  const carry = lastNote
    ? ` Earlier, you said: “${lastNote.quote.slice(0, 220)}”. Keep that context in mind as you answer.`
    : "";
  const messages: ChatMessage[] = active
    ? [{ role: "assistant", content: questions[active.mode] + carry }, ...draft]
    : [];
  const complete = () => {
    if (!active) return;
    const answer = draft
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join("\n\n");
    void save(completeLoopRound(loop, active.id, answer));
  };
  if (debrief && !finished)
    return (
      <section className="loop-panel">
        <h1>Your combined debrief comes after the last round.</h1>
        <p>Complete the remaining rounds to bring the evidence together.</p>
        <Link href={`/loop/${loop.id}`} className="btn btn-primary">
          Back to your loop
        </Link>
      </section>
    );
  if (debrief) {
    const findings = consistencyFindings(loop);
    return (
      <>
        <header className="loop-heading">
          <p className="t-eyebrow">The Loop / Combined debrief</p>
          <h1>The story across your rounds.</h1>
          <p>{loop.role}</p>
          <Link className="loop-link" href={`/loop/${loop.id}`}>
            ← Back to your loop
          </Link>
        </header>
        <section className="loop-notes">
          <div className="loop-section-top">
            <h2>Consistency findings</h2>
            <TopicBadge value="Prototype ownership check" />
          </div>
          <p className="loop-help">
            This preview only compares explicit ownership language. It cannot
            establish contradictions or evaluate interview quality.
          </p>
          {findings.length ? (
            findings.map((finding) => (
              <article className="loop-finding" key={finding.title}>
                <h3>{finding.title}</h3>
                <div className="loop-quotes">
                  {[finding.left, finding.right].map((note) => (
                    <blockquote key={note.roundId}>
                      <span className="t-eyebrow">{note.round}</span>
                      <p>“{note.quote}”</p>
                    </blockquote>
                  ))}
                </div>
                <p>{finding.coaching}</p>
              </article>
            ))
          ) : (
            <p className="loop-empty">
              No paired ownership statements to compare in this preview. A
              complete consistency review will need the future AI integration.
            </p>
          )}
        </section>
        <section className="loop-score-section">
          <h2>Combined scorecard · illustrative</h2>
          <p className="loop-help">
            The fixed sample below previews the layout. It is not a score for
            your answers.
          </p>
          <DebriefView
            debrief={sampleDebrief}
            dimensionLabels={{
              problem_understanding: "Role relevance",
              approach_quality: "Ownership",
              code_correctness: "Technical depth",
              complexity_awareness: "Trade-off reasoning",
            }}
          />
        </section>
        <Link href="/loop/new" className="btn">
          Plan another loop
        </Link>
      </>
    );
  }
  return (
    <>
      <header className="loop-heading">
        <p className="t-eyebrow">The Loop / Your preparation</p>
        <h1>{loop.role}</h1>
        <div className="loop-meta">
          <span>
            {days === null
              ? "Interview date"
              : days < 0
                ? "Interview date has passed"
                : days === 0
                  ? "Interview day"
                  : `${days} days until your interview`}
          </span>
          <time dateTime={loop.interviewDate}>{loop.interviewDate}</time>
          <span>
            {loop.rounds.filter((round) => round.status === "complete").length}{" "}
            / {loop.rounds.length} complete
          </span>
        </div>
      </header>
      <section className="loop-next">
        <div>
          <span className="t-eyebrow">
            {finished
              ? "All rounds complete"
              : active
                ? "In progress"
                : "Next up"}
          </span>
          <h2>
            {finished ? "Bring the whole conversation together." : next?.title}
          </h2>
          {blocked && <p className="loop-quota-note">{blocked}</p>}
        </div>
        {finished ? (
          <Link href={`/loop/${loop.id}/debrief`} className="btn btn-primary">
            View combined debrief
          </Link>
        ) : blocked ? (
          <Link href="/account" className="btn btn-primary">
            Review plan & usage
          </Link>
        ) : active ? (
          <a className="btn btn-primary" href="#loop-round">
            Continue this round
          </a>
        ) : (
          next && (
            <button
              className="btn btn-primary"
              disabled={saving}
              onClick={() => void save(beginLoopRound(loop, next.id))}
            >
              Start next round
            </button>
          )
        )}
      </section>
      {error && (
        <p role="alert" className="loop-error">
          {error}
        </p>
      )}
      <section className="loop-notes" aria-labelledby="loop-memory">
        <div className="loop-section-top">
          <div>
            <p className="t-eyebrow">The thread between rounds</p>
            <h2 id="loop-memory">What the interviewer is learning.</h2>
          </div>
          <Quote size={26} aria-hidden="true" />
        </div>
        <p className="loop-help">
          Draft evidence carried forward into the next question. These are your
          words, not an AI assessment.
        </p>
        {loop.notes.length ? (
          <div className="loop-note-grid">
            {loop.notes.map((note) => (
              <blockquote key={note.roundId}>
                <span className="t-eyebrow">{note.round}</span>
                <p>“{note.quote}”</p>
              </blockquote>
            ))}
          </div>
        ) : (
          <p className="loop-empty">
            Your projects, decisions, and examples will collect here as you
            finish rounds. You start the next conversation with context.
          </p>
        )}
      </section>
      <div className="loop-round-grid">
        <section className="loop-panel">
          <h2>Your rounds</h2>
          <ol className="loop-round-list">
            {loop.rounds.map((round, index) => (
              <li key={round.id}>
                <span className="loop-round-marker" aria-hidden="true">
                  {round.status === "complete" ? (
                    <Check size={16} />
                  ) : round.status === "locked" ? (
                    <Lock size={14} />
                  ) : (
                    index + 1
                  )}
                </span>
                <div>
                  <span className="t-eyebrow">
                    {LOOP_MODE_LABELS[round.mode]}
                  </span>
                  <h3>{round.title}</h3>
                  <p>
                    {round.status === "locked"
                      ? "Unlocks when the previous round is complete."
                      : round.status.replace("_", " ")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section id="loop-round" className="loop-panel loop-live-round">
          {active && !blocked ? (
            <>
              <div className="loop-section-top">
                <h2>Practice draft</h2>
                <Timer
                  sessionId={`loop-preview-${loop.id}-${active.id}`}
                  resumed
                />
              </div>
              <PhaseIndicator
                current={draft.length ? "code" : "approach"}
                steps={[
                  { id: "approach", label: "Prompt" },
                  { id: "code", label: "Answer" },
                  { id: "debrief", label: "Review" },
                ]}
              />
              <div className="loop-chat">
                <ChatPanel
                  messages={messages}
                  streamingText={null}
                  onSend={(text) =>
                    setDraft((current) => [
                      ...current,
                      { role: "user", content: text },
                      {
                        role: "assistant",
                        content:
                          "What changed because of your contribution? Add that detail, or finish this draft to carry your answer into the next round.",
                      },
                    ])
                  }
                  disabled={saving}
                  placeholder="Write the answer you would give…"
                />
              </div>
              <p className="loop-help">
                One draft per preview round. The full interviewer is not
                connected.
              </p>
              <button
                className="btn btn-primary"
                disabled={
                  !draft.some((message) => message.role === "user") || saving
                }
                onClick={complete}
              >
                Finish draft & save notes
              </button>
            </>
          ) : (
            <div className="loop-empty">
              <h2>
                {finished ? "A complete thread." : "One round at a time."}
              </h2>
              <p>
                {finished
                  ? "Your running notes now connect every round. Open the combined debrief to see the review layout."
                  : blocked ||
                    "Start the next round above. Your notes will carry forward as you go."}
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
