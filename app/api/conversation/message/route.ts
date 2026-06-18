import { NextRequest } from "next/server";
import { z } from "zod";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import {
  behavioralSystemPrompt,
  recruiterScreenSystemPrompt,
  behavioralFollowUpSystemPrompt,
  recruiterFollowUpSystemPrompt,
} from "@/lib/conversationPrompts";
import { getBehavioralScenario } from "@/lib/behavioralScenarios";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  session_id: z.string().min(1),
  /** "live" for the main interview, "followup" for post-debrief Q&A. */
  mode: z.enum(["live", "followup"]).default("live"),
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
  const rl = checkRateLimit({ key: `cmsg:${user.id}:${key}`, limit, windowMs: 60_000 });
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

  const session = await prisma.conversationSession.findFirst({
    where: { id: parsed.session_id, userId: user.id },
    select: { id: true, kind: true, scenarioId: true, status: true },
  });
  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  if (session.status === "COMPLETED" && parsed.mode === "live") {
    return new Response(
      JSON.stringify({ error: "Session is completed — switch to follow-up." }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }

  if (parsed.user_turn) {
    await prisma.conversationMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: parsed.user_turn,
      },
    });
  }

  // Build the system prompt and pull turns. Followup mode pulls a separate
  // post-debrief thread (we tag those with role still "user"/"assistant" but
  // they sit in a logically-separate phase via a marker prefix; simpler to
  // just include all messages — the followup prompt sets the new context).
  const turnRows = await prisma.conversationMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });
  const turns = turnRows.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let system: string;
  if (session.kind === "BEHAVIORAL") {
    if (!session.scenarioId) {
      return new Response(JSON.stringify({ error: "Scenario missing" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    const scenario = getBehavioralScenario(session.scenarioId);
    if (!scenario) {
      return new Response(JSON.stringify({ error: "Unknown scenario" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    system =
      parsed.mode === "live"
        ? behavioralSystemPrompt(scenario)
        : behavioralFollowUpSystemPrompt(scenario);
  } else {
    system =
      parsed.mode === "live"
        ? recruiterScreenSystemPrompt()
        : recruiterFollowUpSystemPrompt();
  }

  let messagesForModel = turns;
  if (turns.length === 0) {
    messagesForModel = [
      {
        role: "user",
        content:
          session.kind === "BEHAVIORAL"
            ? "Please start the interview by asking your opening question."
            : "Please start the recruiter screen — introduce yourself briefly and open the conversation.",
      },
    ];
  }

  let anthropic;
  try {
    anthropic = getAnthropic();
  } catch (err) {
    console.error(
      "[conversation/message] config error:",
      err instanceof Error ? err.message : err
    );
    return new Response(
      JSON.stringify({ error: "The interviewer is unavailable. Try again shortly." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const abortController = new AbortController();
  req.signal.addEventListener("abort", () => abortController.abort());

  let assistantBuffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const upstream = await anthropic.messages.stream(
          {
            model: MODEL,
            max_tokens: 500,
            system,
            messages: messagesForModel,
          },
          { signal: abortController.signal }
        );

        for await (const event of upstream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const text = event.delta.text;
            assistantBuffer += text;
            controller.enqueue(sseEncode("delta", JSON.stringify({ text })));
          } else if (event.type === "message_stop") {
            controller.enqueue(sseEncode("done", "{}"));
          }
        }
      } catch (err) {
        const isAbort =
          (err as { name?: string })?.name === "AbortError" ||
          abortController.signal.aborted;
        if (!isAbort) {
          console.error("[conversation/message] upstream stream error:", {
            userId: user.id,
            sessionId: session.id,
            kind: session.kind,
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
            await prisma.conversationMessage.create({
              data: {
                sessionId: session.id,
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
