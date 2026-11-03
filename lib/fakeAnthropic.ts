// A stand-in for the Anthropic client in end-to-end tests (AI_FAKE=1, never in
// production). Deterministic replies so tests can check the whole flow without
// network calls or cost: the interviewer asks a follow-up, then closes the round
// on the candidate's second answer; the grader scores every question 3/5.
import { COMPLETE_MARKER } from "./loopRunEngine";

type Msg = { role: string; content: string | { type: string; text: string }[] };
const text = (c: Msg["content"]) => (typeof c === "string" ? c : c.map((p) => p.text).join(""));
const systemText = (s: unknown) => (typeof s === "string" ? s : Array.isArray(s) ? s.map((p: { text: string }) => p.text).join("") : "");
const usage = { input_tokens: 20, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
const delay = () => new Promise((r) => setTimeout(r, Number(process.env.AI_FAKE_DELAY_MS ?? 30)));

function interviewerReply(messages: Msg[]): string {
  // The first user turn is the "candidate joined" marker; the rest are answers.
  const answers = messages.filter((m) => m.role === "user").length - 1;
  if (answers >= 2) return `Thanks, that's everything for this round.\n${COMPLETE_MARKER}`;
  return "Got it. What was the hardest trade-off, and how did you decide?";
}

function graderReply(user: string): string {
  const ids = [...user.matchAll(/^- ([^:\n]+):/gm)].map((m) => m[1]!.trim());
  return JSON.stringify({
    questions: ids.map((questionId) => ({ questionId, score: 3, evidence: "Gave a relevant, specific example.", missing: "" })),
    strengths: ["Specific examples"],
    improvements: ["More on trade-offs"],
    summary: "The candidate answered with a concrete example. Trade-offs were thin.",
  });
}

export const fakeAnthropic = {
  messages: {
    async create(params: { system?: unknown; messages: Msg[] }) {
      await delay();
      const system = systemText(params.system);
      const reply = system.includes("You grade one interview round")
        ? graderReply(text(params.messages[0]!.content))
        : "Welcome. Let's start: tell me about a project you're proud of.";
      return { content: [{ type: "text", text: reply }], usage };
    },
  },
  beta: {
    promptCaching: {
      messages: {
        async stream(params: { messages: Msg[] }, opts: { signal?: AbortSignal } = {}) {
          const reply = interviewerReply(params.messages);
          const chunks = reply.match(/.{1,12}/gs) ?? [reply];
          return {
            async *[Symbol.asyncIterator]() {
              for (const chunk of chunks) {
                if (opts.signal?.aborted) throw new Error("aborted");
                await delay();
                yield { type: "content_block_delta", delta: { type: "text_delta", text: chunk } };
              }
            },
            async finalMessage() {
              return { content: [{ type: "text", text: reply }], usage };
            },
          };
        },
      },
    },
  },
};
