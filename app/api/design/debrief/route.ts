import { NextRequest } from "next/server";
import { z } from "zod";
import { getDesignProblem } from "@/lib/designProblems";
import { getAnthropic, DESIGN_MODEL } from "@/lib/anthropic";
import { designDebriefSystemPrompt } from "@/lib/designPrompts";
import { describeCanvas } from "@/lib/designCanvas";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DesignDebriefSchema, type DesignDebrief } from "@/lib/designTypes";

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

export async function POST(req: NextRequest) {
  pruneExpired();
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const key = clientKey(req.headers);
  const limit = Number(process.env.RL_DEBRIEF_PER_MIN ?? 10);
  const rl = checkRateLimit({
    key: `ddbrf:${user.id}:${key}`,
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

  const session = await prisma.designSession.findFirst({
    where: { id: parsed.session_id, userId: user.id },
    select: {
      id: true,
      problemId: true,
      status: true,
      scopeAcceptedAt: true,
      movedToDesignEarly: true,
      canvasJson: true,
    },
  });
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

  const existing = await prisma.designDebrief.findUnique({
    where: { sessionId: session.id },
    select: { payload: true },
  });
  if (existing) return Response.json(existing.payload as unknown as DesignDebrief);

  const problem = getDesignProblem(session.problemId);
  if (!problem) return Response.json({ error: "Unknown problem" }, { status: 404 });

  const scopeRows = await prisma.designMessage.findMany({
    where: { sessionId: session.id, phase: "scope" },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });
  const designRows = await prisma.designMessage.findMany({
    where: { sessionId: session.id, phase: "design" },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });
  const scopeTranscript = scopeRows.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  const designTranscript = designRows.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const canvasSpec = describeCanvas(session.canvasJson);

  let anthropic;
  try {
    anthropic = getAnthropic();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Server misconfigured" },
      { status: 500 }
    );
  }

  const system = designDebriefSystemPrompt(
    problem,
    scopeTranscript,
    designTranscript,
    canvasSpec,
    {
      scopeAccepted: session.scopeAcceptedAt !== null,
      movedToDesignEarly: session.movedToDesignEarly,
    }
  );

  const attempts = [
    "Produce the debrief JSON now.",
    "Your previous output was not valid JSON. Output ONLY the JSON object, no fences, no prose.",
  ];

  let lastError = "";
  for (const userTurn of attempts) {
    try {
      const resp = await anthropic.messages.create({
        model: DESIGN_MODEL,
        max_tokens: 1800,
        system,
        messages: [{ role: "user", content: userTurn }],
      });
      const text = resp.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();
      const raw = extractJson(text);
      const debrief = DesignDebriefSchema.parse(raw);
      const s = debrief.scores;
      const total =
        s.requirements_clarity.score +
        s.architecture_design.score +
        s.scalability.score +
        s.tradeoff_reasoning.score +
        s.communication.score;
      debrief.total_score = total;

      await prisma.$transaction([
        prisma.designDebrief.create({
          data: {
            sessionId: session.id,
            payload: debrief as unknown as object,
            totalScore: total,
          },
        }),
        prisma.designSession.update({
          where: { id: session.id },
          data: {
            status: "COMPLETED",
            totalScore: total,
            recommendation: debrief.overall_recommendation,
            completedAt: new Date(),
          },
        }),
        prisma.designSession.updateMany({
          where: {
            userId: user.id,
            problemId: session.problemId,
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
