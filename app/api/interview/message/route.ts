import { NextRequest } from "next/server";
import { z } from "zod";
import { getProblem } from "@/lib/problems";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { phasePromptFor } from "@/lib/prompts";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  interview_id: z.string().min(1),
  problem_id: z.string().min(1),
  phase: z.enum(["approach", "code", "debrief"]),
  // Only the latest user turn the client wants persisted. Server pulls prior context from DB.
  user_turn: z.string().min(1).max(8_000).nullable(),
  user_code: z.string().max(20_000).optional(),
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
  const rl = checkRateLimit({ key: `msg:${user.id}:${key}`, limit, windowMs: 60_000 });
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

  // Verify the interview belongs to this user, and isn't already debriefed (read-only).
  const interview = await prisma.interview.findFirst({
    where: { id: parsed.interview_id, userId: user.id },
    select: { id: true, problemId: true, status: true },
  });
  if (!interview) {
    return new Response(JSON.stringify({ error: "Interview not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  if (interview.problemId !== parsed.problem_id) {
    return new Response(JSON.stringify({ error: "Problem mismatch" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (interview.status === "COMPLETED" && parsed.phase !== "debrief") {
    return new Response(
      JSON.stringify({ error: "This interview is already completed — read-only." }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }

  const problem = getProblem(parsed.problem_id);
  if (!problem) {
    return new Response(JSON.stringify({ error: "Unknown problem_id" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  // Persist any user turn before calling the model so we don't lose it on disconnect.
  if (parsed.user_turn) {
    await prisma.message.create({
      data: {
        interviewId: interview.id,
        phase: parsed.phase,
        role: "user",
        content: parsed.user_turn,
      },
    });
  }
  // Persist the latest snapshot of code for the code phase (debounce on the client).
  if (typeof parsed.user_code === "string" && parsed.phase === "code") {
    await prisma.interview.update({
      where: { id: interview.id },
      data: { code: parsed.user_code },
    });
  }

  // Pull the full message history for the relevant phases from DB.
  // Approach: only "approach" phase messages.
  // Code: approach (as transcript context, used by phasePromptFor) + code messages as turns.
  // Debrief follow-ups: only "debrief" phase messages.
  const phaseFilter =
    parsed.phase === "approach"
      ? ["approach"]
      : parsed.phase === "code"
      ? ["code"]
      : ["debrief"];

  const turnRows = await prisma.message.findMany({
    where: { interviewId: interview.id, phase: { in: phaseFilter } },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });
  const turns = turnRows.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // For Code & Debrief prompts we want the approach transcript context.
  const phase1TranscriptRows =
    parsed.phase === "approach"
      ? []
      : await prisma.message.findMany({
          where: { interviewId: interview.id, phase: "approach" },
          orderBy: { createdAt: "asc" },
          select: { role: true, content: true },
        });
  const phase1Transcript = phase1TranscriptRows.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const userCode =
    parsed.user_code ??
    (
      await prisma.interview.findUnique({
        where: { id: interview.id },
        select: { code: true },
      })
    )?.code ??
    "";

  // Bootstrap: if the approach phase has zero turns, inject a synthetic kickoff so the
  // interviewer opens the conversation naturally.
  let messagesForModel = turns;
  if (parsed.phase === "approach" && turns.length === 0) {
    messagesForModel = [
      {
        role: "user",
        content:
          "Please start the interview with a brief, natural greeting and ask me to walk through my approach to this problem.",
      },
    ];
  } else if (turns.length === 0) {
    // Defensive: never send empty messages to the API.
    messagesForModel = [{ role: "user", content: "..." }];
  }

  const system = phasePromptFor(parsed.phase, problem, phase1Transcript, userCode);

  let anthropic;
  try {
    anthropic = getAnthropic();
  } catch (err) {
    // Log the underlying config error server-side; client gets a generic
    // message so we don't leak env-var names or upstream service details.
    console.error(
      "[interview/message] config error:",
      err instanceof Error ? err.message : err
    );
    return new Response(
      JSON.stringify({ error: "The interviewer is unavailable. Try again shortly." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const abortController = new AbortController();
  req.signal.addEventListener("abort", () => abortController.abort());

  // Approach-phase only: the model must prefix its reply with [READY] or [CONTINUE].
  // We parse it server-side, strip from the visible stream, and emit a one-shot
  // `meta` SSE event so the client can flip the ReadyPrompt state.
  const parsePrefix = parsed.phase === "approach";
  const PREFIX_RE = /^\s*\[(READY|CONTINUE)\]\s*/;
  const PREFIX_MAX = 24; // longest valid prefix + whitespace, with slack
  let prefixDetected = !parsePrefix;
  let prefixBuffer = "";

  // `assistantBuffer` holds the text we'll persist + render — i.e. AFTER the prefix
  // has been stripped. The raw prefix is metadata, not part of the conversation.
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
        const ready = m ? m[1] === "READY" : false;
        const remainder = m ? raw.slice(m[0].length) : raw;
        controller.enqueue(sseEncode("meta", JSON.stringify({ ready })));
        if (ready) {
          // Stamp first acceptance only — never overwrite once set.
          prisma.interview
            .updateMany({
              where: { id: interview.id, approachAcceptedAt: null },
              data: { approachAcceptedAt: new Date() },
            })
            .catch(() => {
              /* non-fatal — the meta event already shipped */
            });
        }
        prefixDetected = true;
        emitDelta(remainder);
      };

      try {
        const upstream = await anthropic.messages.stream(
          {
            model: MODEL,
            max_tokens: parsed.phase === "approach" ? 400 : 700,
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
                // Model didn't follow protocol — treat as CONTINUE, ship buffer as-is.
                await settlePrefix(prefixBuffer);
                prefixBuffer = "";
              }
            } else {
              emitDelta(text);
            }
          } else if (event.type === "message_stop") {
            // If we ended before the prefix could be parsed (short reply), settle now.
            if (!prefixDetected && prefixBuffer.length > 0) {
              await settlePrefix(prefixBuffer);
              prefixBuffer = "";
            }
            controller.enqueue(sseEncode("done", "{}"));
          }
        }
      } catch (err) {
        // Two paths to handle:
        //   1. Client disconnected — abortController.signal.aborted is true.
        //      The client is gone; no point emitting anything, and the error
        //      would be a noise log entry.
        //   2. Real upstream error (auth, 429, 529, network, etc.) — log the
        //      detailed reason server-side for debugging, but emit a generic
        //      message to the client. The previous behavior forwarded the raw
        //      Anthropic SDK message which leaked model name, error class,
        //      and request IDs.
        const isAbort =
          (err as { name?: string })?.name === "AbortError" ||
          abortController.signal.aborted;
        if (!isAbort) {
          console.error("[interview/message] upstream stream error:", {
            userId: user.id,
            interviewId: interview.id,
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
          } catch {
            /* already closed */
          }
        }
      } finally {
        // Persist the assistant turn (even partial) so context is durable.
        if (assistantBuffer.trim()) {
          try {
            await prisma.message.create({
              data: {
                interviewId: interview.id,
                phase: parsed.phase,
                role: "assistant",
                content: assistantBuffer,
              },
            });
          } catch {
            /* swallow — already streamed to client */
          }
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
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
