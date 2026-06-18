import { NextRequest } from "next/server";
import { z } from "zod";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import {
  behavioralDebriefSystemPrompt,
  recruiterDebriefSystemPrompt,
} from "@/lib/conversationPrompts";
import {
  BehavioralDebriefSchema,
  RecruiterDebriefSchema,
  type ConversationDebrief,
} from "@/lib/conversationTypes";
import { getBehavioralScenario } from "@/lib/behavioralScenarios";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ session_id: z.string().min(1) });

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function sumScores(scores: Record<string, { score: number }>): number {
  return Object.values(scores).reduce((acc, s) => acc + s.score, 0);
}

export async function POST(req: NextRequest) {
  pruneExpired();
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const key = clientKey(req.headers);
  const limit = Number(process.env.RL_DEBRIEF_PER_MIN ?? 10);
  const rl = checkRateLimit({
    key: `cdbrf:${user.id}:${key}`,
    limit,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return Response.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429, headers: { "retry-after": Math.ceil(rl.resetMs / 1000).toString() } }
    );
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid request" },
      { status: 400 }
    );
  }

  const session = await prisma.conversationSession.findFirst({
    where: { id: parsed.session_id, userId: user.id },
    select: { id: true, kind: true, scenarioId: true, status: true },
  });
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

  const existing = await prisma.conversationDebrief.findUnique({
    where: { sessionId: session.id },
    select: { payload: true },
  });
  if (existing) {
    return Response.json(existing.payload as unknown as ConversationDebrief);
  }

  const transcriptRows = await prisma.conversationMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });
  const transcript = transcriptRows.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let system: string;
  if (session.kind === "BEHAVIORAL") {
    if (!session.scenarioId) {
      return Response.json({ error: "Scenario missing" }, { status: 500 });
    }
    const scenario = getBehavioralScenario(session.scenarioId);
    if (!scenario) return Response.json({ error: "Unknown scenario" }, { status: 404 });
    system = behavioralDebriefSystemPrompt(scenario, transcript);
  } else {
    system = recruiterDebriefSystemPrompt(transcript);
  }

  let anthropic;
  try {
    anthropic = getAnthropic();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Server misconfigured" },
      { status: 500 }
    );
  }

  const attempts = [
    "Produce the debrief JSON now.",
    "Your previous output was not valid JSON. Output ONLY the JSON object, no fences, no prose.",
  ];

  let lastError = "";
  for (const userTurn of attempts) {
    try {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: userTurn }],
      });
      const text = resp.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();
      const raw = extractJson(text);

      const schema =
        session.kind === "BEHAVIORAL" ? BehavioralDebriefSchema : RecruiterDebriefSchema;
      const debrief = schema.parse(raw) as ConversationDebrief;
      const total = sumScores(debrief.scores as unknown as Record<string, { score: number }>);
      debrief.total_score = total;

      await prisma.$transaction([
        prisma.conversationDebrief.create({
          data: {
            sessionId: session.id,
            payload: debrief as unknown as object,
            totalScore: total,
          },
        }),
        prisma.conversationSession.update({
          where: { id: session.id },
          data: {
            status: "COMPLETED",
            totalScore: total,
            recommendation: debrief.overall_recommendation,
            completedAt: new Date(),
          },
        }),
        prisma.conversationSession.updateMany({
          where: {
            userId: user.id,
            kind: session.kind,
            scenarioId: session.scenarioId,
            status: "IN_PROGRESS",
            id: { not: session.id },
          },
          data: { status: "ABANDONED", completedAt: new Date() },
        }),
      ]);

      return Response.json(debrief);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return Response.json(
    { error: "Failed to produce a valid debrief", detail: lastError },
    { status: 502 }
  );
}
