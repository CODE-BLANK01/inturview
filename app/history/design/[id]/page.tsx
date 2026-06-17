import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { DesignDebriefView } from "@/components/design/DesignDebriefView";
import { DifficultyBadge, TopicBadge } from "@/components/Badges";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { describeCanvas } from "@/lib/designCanvas";
import type { Difficulty } from "@/lib/types";
import type { DesignDebrief } from "@/lib/designTypes";

export const dynamic = "force-dynamic";

export default async function DesignHistoryPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return null;

  const isAdmin = user.role === "ADMIN";

  const session = await prisma.designSession.findFirst({
    where: { id: params.id, ...(isAdmin ? {} : { userId: user.id }) },
    select: {
      id: true,
      problemId: true,
      status: true,
      canvasJson: true,
      startedAt: true,
      completedAt: true,
      user: { select: { email: true, name: true } },
      problem: {
        select: { title: true, difficulty: true, topic: true, prompt: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { phase: true, role: true, content: true, createdAt: true },
      },
      debrief: { select: { payload: true } },
    },
  });

  if (!session) notFound();

  const debrief = session.debrief?.payload as unknown as DesignDebrief | null;
  const scope = session.messages.filter((m) => m.phase === "scope");
  const design = session.messages.filter((m) => m.phase === "design");
  const followUp = session.messages.filter((m) => m.phase === "debrief");
  const canvasSpec = describeCanvas(session.canvasJson);

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/history"
            className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-text"
          >
            <ArrowLeft className="h-4 w-4" />
            History
          </Link>
          {isAdmin && session.user && (
            <span className="text-xs text-text-dim">
              {session.user.name ?? session.user.email}
            </span>
          )}
        </div>

        <header className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold">{session.problem.title}</h1>
            <DifficultyBadge value={session.problem.difficulty as Difficulty} />
            <TopicBadge value={session.problem.topic} />
            <span
              className="badge"
              style={{
                background: "rgb(var(--bg-inset))",
                color: "rgb(var(--text-muted))",
                borderColor: "rgb(var(--border-base))",
              }}
            >
              System design
            </span>
          </div>
          <p className="text-sm text-text-muted whitespace-pre-wrap">
            {session.problem.prompt}
          </p>
        </header>

        {debrief && <DesignDebriefView debrief={debrief} />}

        <section className="panel p-5">
          <h2 className="text-sm uppercase tracking-wide text-text-dim mb-3">
            Final whiteboard
          </h2>
          <pre className="text-xs text-text-muted whitespace-pre-wrap font-mono">
{canvasSpec}
          </pre>
        </section>

        {scope.length > 0 && (
          <TranscriptSection title="Scope" messages={scope} />
        )}
        {design.length > 0 && (
          <TranscriptSection title="Design" messages={design} />
        )}
        {followUp.length > 0 && (
          <TranscriptSection title="Follow-up" messages={followUp} />
        )}
      </main>
    </>
  );
}

function TranscriptSection({
  title,
  messages,
}: {
  title: string;
  messages: { role: string; content: string; createdAt: Date }[];
}) {
  return (
    <section className="panel p-5">
      <h2 className="text-sm uppercase tracking-wide text-text-dim mb-3">{title}</h2>
      <ul className="space-y-3">
        {messages.map((m, i) => (
          <li key={i} className="text-sm">
            <span className="text-text-dim text-xs mr-2 uppercase">
              {m.role === "assistant" ? "Interviewer" : "You"}
            </span>
            <span className="whitespace-pre-wrap">{m.content}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
