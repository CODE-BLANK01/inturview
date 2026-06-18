import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { ConversationDebriefView } from "@/components/conversation/ConversationDebriefView";
import { TopicBadge } from "@/components/Badges";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ConversationDebrief } from "@/lib/conversationTypes";

export const dynamic = "force-dynamic";

export default async function ConversationHistoryPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  if (!user) return null;

  const isAdmin = user.role === "ADMIN";

  const session = await prisma.conversationSession.findFirst({
    where: { id: params.id, ...(isAdmin ? {} : { userId: user.id }) },
    select: {
      id: true,
      kind: true,
      status: true,
      startedAt: true,
      completedAt: true,
      user: { select: { email: true, name: true } },
      scenario: { select: { title: true, category: true, prompt: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true, createdAt: true },
      },
      debrief: { select: { payload: true } },
    },
  });

  if (!session) notFound();

  const debrief = session.debrief?.payload as unknown as ConversationDebrief | null;
  const title =
    session.kind === "BEHAVIORAL"
      ? session.scenario?.title ?? "Behavioral"
      : "Recruiter screen";
  const subtitle =
    session.kind === "BEHAVIORAL"
      ? session.scenario?.category ?? "Behavioral"
      : "25-min initial phone screen";
  const prompt =
    session.kind === "BEHAVIORAL"
      ? session.scenario?.prompt ?? ""
      : "A recruiter is calling for an initial phone screen.";

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
            <h1 className="text-2xl font-semibold">{title}</h1>
            <TopicBadge value={subtitle} />
            <span
              className="badge"
              style={{
                background: "rgb(var(--bg-inset))",
                color: "rgb(var(--text-muted))",
                borderColor: "rgb(var(--border-base))",
              }}
            >
              {session.kind === "BEHAVIORAL" ? "Behavioral" : "Recruiter screen"}
            </span>
          </div>
          <p className="text-sm text-text-muted whitespace-pre-wrap">{prompt}</p>
        </header>

        {debrief && (
          <ConversationDebriefView
            debrief={debrief}
            kind={session.kind as "BEHAVIORAL" | "RECRUITER_SCREEN"}
          />
        )}

        <section className="panel p-5">
          <h2 className="text-sm uppercase tracking-wide text-text-dim mb-3">Transcript</h2>
          <ul className="space-y-3">
            {session.messages.map((m, i) => (
              <li key={i} className="text-sm">
                <span className="text-text-dim text-xs mr-2 uppercase">
                  {m.role === "assistant" ? "Interviewer" : "You"}
                </span>
                <span className="whitespace-pre-wrap">{m.content}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
