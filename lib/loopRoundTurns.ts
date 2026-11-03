import type { LoopMessage } from "@prisma/client";

/** The API needs a user turn first; the round opens with an implicit "candidate joined". */
export const JOIN_TURN = "(The candidate has joined the round. Begin.)";

export function toTurns(messages: Pick<LoopMessage, "role" | "content">[]) {
  const turns: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: JOIN_TURN }];
  for (const m of messages) {
    const role = m.role === "interviewer" ? "assistant" : "user";
    const last = turns[turns.length - 1]!;
    // Merge consecutive same-role turns (e.g. two candidate messages in a row).
    if (last.role === role) last.content += `\n\n${m.content}`;
    else turns.push({ role, content: m.content });
  }
  return turns;
}
