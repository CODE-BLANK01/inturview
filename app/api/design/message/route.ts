import { NextRequest } from "next/server";
import { z } from "zod";
import { getDesignProblem } from "@/lib/designProblems";
import { getAnthropic, DESIGN_MODEL } from "@/lib/anthropic";
import { designPhasePromptFor } from "@/lib/designPrompts";
import { describeCanvas } from "@/lib/designCanvas";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  session_id: z.string().min(1),
  problem_id: z.string().min(1),
  phase: z.enum(["scope", "design", "debrief"]),
  user_turn: z.string().min(1).max(8_000).nullable(),
});

function sseEncode(event: string, data: string): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${data}\n\n`);
}

export async function POST(req: NextRequest) {
  pruneExpired();
  const user = await requireUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Not signed in" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const key = clientKey(req.headers);
  const limit = Number(process.env.RL_MESSAGE_PER_MIN ?? 20);
  const rl = checkRateLimit({ key: `dmsg:${user.id}:${key}`, limit, windowMs: 60_000 });
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Slow down a bit." }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": Math.ceil(rl.resetMs / 1000).toString(),
        },
      }
    );
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Invalid request" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const session = await prisma.designSession.findFirst({
    where: { id: parsed.session_id, userId: user.id },
    select: { id: true, problemId: true, status: true, canvasJson: true },
  });
  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  if (session.problemId !== parsed.problem_id) {
    return new Response(JSON.stringify({ error: "Problem mismatch" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (session.status === "COMPLETED" && parsed.phase !== "debrief") {
    return new Response(
      JSON.stringify({ error: "This session is already completed — read-only." }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }

  const problem = getDesignProblem(parsed.problem_id);
  if (!problem) {
    return new Response(JSON.stringify({ error: "Unknown problem_id" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  if (parsed.user_turn) {
    await prisma.designMessage.create({
      data: {
        sessionId: session.id,
        phase: parsed.phase,
        role: "user",
        content: parsed.user_turn,
      },
    });
  }

  const phaseFilter =
    parsed.phase === "scope"
      ? ["scope"]
      : parsed.phase === "design"
      ? ["design"]
      : ["debrief"];

  const turnRows = await prisma.designMessage.findMany({
    where: { sessionId: session.id, phase: { in: phaseFilter } },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });
  const turns = turnRows.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const scopeTranscriptRows =
    parsed.phase === "scope"
      ? []
      : await prisma.designMessage.findMany({
          where: { sessionId: session.id, phase: "scope" },
          orderBy: { createdAt: "asc" },
          select: { role: true, content: true },
        });
  const scopeTranscript = scopeTranscriptRows.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const canvasSpec = describeCanvas(session.canvasJson);

  let messagesForModel = turns;
  if (parsed.phase === "scope" && turns.length === 0) {
    messagesForModel = [
      {
        role: "user",
        content:
          "Please start the interview with a brief, natural greeting and re-state the problem so I know what we're designing.",
      },
    ];
  } else if (turns.length === 0) {
    messagesForModel = [{ role: "user", content: "..." }];
  }

  const system = designPhasePromptFor(parsed.phase, problem, scopeTranscript, canvasSpec);

  let anthropic;
  try {
    anthropic = getAnthropic();
  } catch (err) {
    console.error(
      "[design/message] config error:",
      err instanceof Error ? err.message : err
    );
    return new Response(
      JSON.stringify({ error: "The interviewer is unavailable. Try again shortly." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const abortController = new AbortController();
  req.signal.addEventListener("abort", () => abortController.abort());

  // Scope-phase only: model must prefix with [SCOPED] or [CONTINUE].
  const parsePrefix = parsed.phase === "scope";
  const PREFIX_RE = /^\s*\[(SCOPED|CONTINUE)\]\s*/;
  const PREFIX_MAX = 24;
  let prefixDetected = !parsePrefix;
  let prefixBuffer = "";
  let assistantBuffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emitDelta = (text: string) => {
        if (!text) return;
        assistantBuffer += text;
        controller.enqueue(sseEncode("delta", JSON.stringify({ text })));
      };

      const settlePrefix = async (raw: string) => {
        const m = raw.match(PREFIX_RE);
        const scoped = m ? m[1] === "SCOPED" : false;
        const remainder = m ? raw.slice(m[0].length) : raw;
        controller.enqueue(sseEncode("meta", JSON.stringify({ scoped })));
        if (scoped) {
          prisma.designSession
            .updateMany({
              where: { id: session.id, scopeAcceptedAt: null },
              data: { scopeAcceptedAt: new Date() },
            })
            .catch(() => {});
        }
        prefixDetected = true;
        emitDelta(remainder);
      };

      try {
        const upstream = await anthropic.messages.stream(
          {
            model: DESIGN_MODEL,
            max_tokens: parsed.phase === "scope" ? 400 : 700,
            system,
            messages: messagesForModel,
          },
          { signal: abortController.signal }
        );

        for await (const event of upstream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const text = event.delta.text;
            if (!prefixDetected) {
              prefixBuffer += text;
              if (PREFIX_RE.test(prefixBuffer)) {
                await settlePrefix(prefixBuffer);
                prefixBuffer = "";
              } else if (prefixBuffer.length >= PREFIX_MAX) {
                await settlePrefix(prefixBuffer);
                prefixBuffer = "";
              }
            } else {
              emitDelta(text);
            }
          } else if (event.type === "message_stop") {
            if (!prefixDetected && prefixBuffer.length > 0) {
              await settlePrefix(prefixBuffer);
              prefixBuffer = "";
            }
            controller.enqueue(sseEncode("done", "{}"));
          }
        }
      } catch (err) {
        const isAbort =
          (err as { name?: string })?.name === "AbortError" ||
          abortController.signal.aborted;
        if (!isAbort) {
          console.error("[design/message] upstream stream error:", {
            userId: user.id,
            sessionId: session.id,
            phase: parsed.phase,
            error: err instanceof Error ? err.message : String(err),
          });
          try {
            controller.enqueue(
              sseEncode(
                "error",
                JSON.stringify({
                  message: "Couldn't reach the interviewer. Refresh to retry.",
                })
              )
            );
          } catch {}
        }
      } finally {
        if (assistantBuffer.trim()) {
          try {
            await prisma.designMessage.create({
              data: {
                sessionId: session.id,
                phase: parsed.phase,
                role: "assistant",
                content: assistantBuffer,
              },
            });
          } catch {}
        }
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
