import { NextRequest } from "next/server";
import { z } from "zod";
import { getProblem } from "@/lib/problems";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { debriefSystemPrompt } from "@/lib/prompts";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { Debrief } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  interview_id: z.string().min(1),
  user_code: z.string().max(20_000),
});

const DimensionSchema = z.object({
  score: z.number().min(0).max(5),
  max: z.literal(5),
  evidence: z.string(),
});

const DebriefSchema = z.object({
  overall_recommendation: z.enum([
    "Strong Hire",
    "Hire",
    "Lean Hire",
    "No Hire",
    "Strong No Hire",
  ]),
  scores: z.object({
    problem_understanding: DimensionSchema,
    approach_quality: DimensionSchema,
    code_correctness: DimensionSchema,
    complexity_awareness: DimensionSchema,
    communication: DimensionSchema,
  }),
  total_score: z.number().min(0).max(25),
  max_score: z.literal(25),
  strengths: z.array(z.string()).min(1),
  improvements: z.array(z.string()).min(1),
  optimal_solution_notes: z.string().min(1),
  interviewer_summary: z.string().min(1),
});

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
    key: `dbrf:${user.id}:${key}`,
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

  const interview = await prisma.interview.findFirst({
    where: { id: parsed.interview_id, userId: user.id },
    select: {
      id: true,
      problemId: true,
      status: true,
      approachAcceptedAt: true,
      movedToCodeEarly: true,
    },
  });
  if (!interview) return Response.json({ error: "Interview not found" }, { status: 404 });

  // If a debrief already exists, return it (idempotent).
  const existing = await prisma.debrief.findUnique({
    where: { interviewId: interview.id },
    select: { payload: true },
  });
  if (existing) return Response.json(existing.payload as unknown as Debrief);

  const problem = getProblem(interview.problemId);
  if (!problem) return Response.json({ error: "Unknown problem" }, { status: 404 });

  // Pull the approach transcript for context.
  const transcriptRows = await prisma.message.findMany({
    where: { interviewId: interview.id, phase: "approach" },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });
  const phase1Transcript = transcriptRows.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Snapshot code into the interview row before generating debrief.
  await prisma.interview.update({
    where: { id: interview.id },
    data: { code: parsed.user_code, language: undefined },
  });

  let anthropic;
  try {
    anthropic = getAnthropic();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Server misconfigured" },
      { status: 500 }
    );
  }

  const system = debriefSystemPrompt(problem, phase1Transcript, parsed.user_code, {
    approachAccepted: interview.approachAcceptedAt !== null,
    movedToCodeEarly: interview.movedToCodeEarly,
  });

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
      const debrief = DebriefSchema.parse(raw) as Debrief;
      const s = debrief.scores;
      const total =
        s.problem_understanding.score +
        s.approach_quality.score +
        s.code_correctness.score +
        s.complexity_awareness.score +
        s.communication.score;
      debrief.total_score = total;

      // Persist debrief, flip THIS interview to COMPLETED, AND mark any
      // sibling IN_PROGRESS interviews for the same problem as ABANDONED.
      // The sibling cleanup hardens the dashboard against legacy orphans
      // accumulated before the start-route reuse logic existed.
      await prisma.$transaction([
        prisma.debrief.create({
          data: {
            interviewId: interview.id,
            payload: debrief as unknown as object,
            totalScore: total,
          },
        }),
        prisma.interview.update({
          where: { id: interview.id },
          data: {
            status: "COMPLETED",
            totalScore: total,
            recommendation: debrief.overall_recommendation,
            completedAt: new Date(),
          },
        }),
        prisma.interview.updateMany({
          where: {
            userId: user.id,
            problemId: interview.problemId,
            status: "IN_PROGRESS",
            id: { not: interview.id },
          },
          data: {
            status: "ABANDONED",
            completedAt: new Date(),
          },
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
