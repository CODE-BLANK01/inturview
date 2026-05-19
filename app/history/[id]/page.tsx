import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { DebriefView } from "@/components/DebriefView";
import { DifficultyBadge, TopicBadge } from "@/components/Badges";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProblem } from "@/lib/problems";
import type { Difficulty, Debrief } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HistoryDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return null;

  // Admins can view ANY user's transcript (read-only audit/monitor). Regular
  // users can only see their own.
  const isAdmin = user.role === "ADMIN";

  const interview = await prisma.interview.findFirst({
    where: { id: params.id, ...(isAdmin ? {} : { userId: user.id }) },
    select: {
      id: true,
      problemId: true,
      status: true,
      language: true,
      code: true,
      startedAt: true,
      completedAt: true,
      user: { select: { email: true, name: true } },
      problem: {
        select: { title: true, difficulty: true, topic: true, leetcodeUrl: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { phase: true, role: true, content: true, createdAt: true },
      },
      debrief: { select: { payload: true } },
    },
  });

  if (!interview) notFound();

  const debrief = interview.debrief?.payload as unknown as Debrief | null;
  const problem = getProblem(interview.problemId);
  const approach = interview.messages.filter((m) => m.phase === "approach");
  const codeChat = interview.messages.filter((m) => m.phase === "code");
  const followUp = interview.messages.filter((m) => m.phase === "debrief");

  const viewingOther = isAdmin && interview.user.email !== user.email;
  const isAbandoned = interview.status === "ABANDONED";
  const isCompleted = interview.status === "COMPLETED";

  // Human-readable header tag describing how the session ended.
  const statusLabel = interview.completedAt
    ? isAbandoned
      ? `Ended early ${new Date(interview.completedAt).toLocaleString()}`
      : isCompleted
      ? `Completed ${new Date(interview.completedAt).toLocaleString()}`
      : new Date(interview.completedAt).toLocaleString()
    : "In progress";

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {viewingOther && (
          <div className="mb-4 panel border-hard/40 bg-hard/5 px-4 py-2.5 flex items-center justify-between text-sm">
            <span className="text-hard">
              Admin view — looking at {interview.user.email}&apos;s session
            </span>
            <Link
              href="/admin/interviews"
              className="text-xs text-text-muted hover:text-text"
            >
              ← Back to admin
            </Link>
          </div>
        )}
        <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
          <Link
            href={viewingOther ? "/admin/interviews" : "/history"}
            className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {viewingOther ? "Admin interviews" : "All interviews"}
          </Link>
          <div
            className="text-xs"
            style={{
              color: isAbandoned ? "rgb(var(--text-muted))" : "rgb(var(--text-tertiary))",
            }}
          >
            {statusLabel}
          </div>
        </div>

        {isAbandoned && (
          <div
            className="mb-6 panel px-4 py-3 flex items-start gap-3"
            style={{
              borderColor: "rgb(var(--border-strong))",
              background: "rgb(var(--bg-inset) / 0.6)",
            }}
          >
            <AlertTriangle
              className="h-4 w-4 mt-0.5 text-text-muted shrink-0"
              aria-hidden
            />
            <div className="text-sm">
              <p className="text-text font-medium">Session ended without a debrief.</p>
              <p className="text-text-muted mt-0.5 text-xs leading-relaxed">
                You ended this session before submitting your solution, so there&apos;s
                no scorecard. The transcript and any code you wrote are below — pick the
                problem again from{" "}
                <Link
                  href="/problems"
                  className="underline underline-offset-2 hover:text-text"
                >
                  Problems
                </Link>{" "}
                to start a fresh attempt.
              </p>
            </div>
          </div>
        )}

        <header className="panel p-5 mb-6">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <DifficultyBadge value={interview.problem.difficulty as Difficulty} />
            <TopicBadge value={interview.problem.topic} />
            {interview.problem.leetcodeUrl && (
              <a
                href={interview.problem.leetcodeUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-text-dim hover:text-text inline-flex items-center gap-1 text-xs"
              >
                LeetCode <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <h1 className="text-2xl font-semibold">{interview.problem.title}</h1>
          {problem && (
            <p className="mt-2 text-sm text-text-muted whitespace-pre-wrap leading-relaxed">
              {problem.description}
            </p>
          )}
        </header>

        {debrief && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Debrief</h2>
            <DebriefView debrief={debrief} />
          </section>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="panel p-5">
            <h2 className="text-lg font-semibold mb-3">Approach transcript</h2>
            {approach.length === 0 ? (
              <p className="text-sm text-text-dim">No messages.</p>
            ) : (
              <div className="space-y-3">
                {approach.map((m, i) => (
                  <Bubble key={i} role={m.role} text={m.content} />
                ))}
              </div>
            )}
          </div>

          <div className="panel p-5">
            <h2 className="text-lg font-semibold mb-3">
              {isAbandoned ? "Code at end" : "Submitted code"}
              <span className="ml-2 text-xs text-text-dim font-normal">
                ({interview.language || "python"})
              </span>
            </h2>
            <pre className="rounded-md bg-bg-surface border border-border p-3 overflow-auto text-xs leading-relaxed font-mono whitespace-pre">
              {interview.code?.trim() ? interview.code : "(none)"}
            </pre>
          </div>
        </section>

        {codeChat.length > 0 && (
          <section className="panel p-5 mb-8">
            <h2 className="text-lg font-semibold mb-3">Mid-coding chat</h2>
            <div className="space-y-3">
              {codeChat.map((m, i) => (
                <Bubble key={i} role={m.role} text={m.content} />
              ))}
            </div>
          </section>
        )}

        {followUp.length > 0 && (
          <section className="panel p-5">
            <h2 className="text-lg font-semibold mb-3">Follow-up Q&amp;A</h2>
            <div className="space-y-3">
              {followUp.map((m, i) => (
                <Bubble key={i} role={m.role} text={m.content} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function Bubble({ role, text }: { role: string; text: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap text-sm rounded-lg px-3 py-2 ${
          isUser
            ? "bg-accent text-white"
            : "bg-bg-surface border border-border text-text"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
