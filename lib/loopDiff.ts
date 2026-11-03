// What changed between the last published version of a loop and the draft, in
// words a hiring team reads before publishing. Pure; unit-tested; client-safe.
import type { LoopRoundConfig } from "./loopTemplates";

export interface LoopShape {
  name: string;
  description: string | null;
  roleTarget: string | null;
  level: string | null;
  rounds: LoopRoundConfig[];
}

const label = (r: LoopRoundConfig, i: number) => `Round ${i + 1} (${r.title})`;

function questionsText(q: LoopRoundConfig["questions"]): string {
  if (q.mode === "fixed") return `${q.questionIds.length} chosen question${q.questionIds.length === 1 ? "" : "s"}`;
  const filters = [q.tags.length && `tags ${q.tags.join(", ")}`, q.roles.length && `roles ${q.roles.join(", ")}`, q.level && `level ${q.level}`].filter(Boolean);
  return `${q.count} from a pool${filters.length ? ` (${filters.join("; ")})` : ""}`;
}

export function diffLoop(published: LoopShape | null, draft: LoopShape): string[] {
  if (!published) return ["First version: nothing has been published yet."];
  const changes: string[] = [];
  if (published.name !== draft.name) changes.push(`Renamed from "${published.name}" to "${draft.name}".`);
  if ((published.roleTarget ?? "") !== (draft.roleTarget ?? "")) changes.push(`Role changed to "${draft.roleTarget || "none"}".`);
  if ((published.level ?? "") !== (draft.level ?? "")) changes.push(`Level changed to ${draft.level || "any"}.`);
  if ((published.description ?? "") !== (draft.description ?? "")) changes.push("Description edited.");

  const before = new Map(published.rounds.map((r, i) => [r.id, { r, i }]));
  const after = new Map(draft.rounds.map((r, i) => [r.id, { r, i }]));
  for (const [id, { r, i }] of before) if (!after.has(id)) changes.push(`Removed ${label(r, i)}.`);
  draft.rounds.forEach((r, i) => {
    const old = before.get(r.id);
    if (!old) return void changes.push(`Added ${label(r, i)}: ${r.durationMinutes} min, ${questionsText(r.questions)}.`);
    const o = old.r;
    const parts: string[] = [];
    if (o.title !== r.title) parts.push(`renamed from "${o.title}"`);
    if (o.category !== r.category) parts.push(`category changed`);
    if (o.durationMinutes !== r.durationMinutes) parts.push(`${o.durationMinutes} → ${r.durationMinutes} min`);
    if (questionsText(o.questions) !== questionsText(r.questions) || JSON.stringify(o.questions) !== JSON.stringify(r.questions)) {
      parts.push(`questions: ${questionsText(o.questions)} → ${questionsText(r.questions)}`);
    }
    if ((o.candidateBrief ?? "") !== (r.candidateBrief ?? "")) parts.push("brief edited");
    if (parts.length) changes.push(`${label(r, i)}: ${parts.join(", ")}.`);
  });
  const order = (rs: LoopRoundConfig[]) => rs.map((r) => r.id).filter((id) => before.has(id) && after.has(id)).join();
  if (order(published.rounds) !== order(draft.rounds)) changes.push("Rounds reordered.");
  return changes;
}
