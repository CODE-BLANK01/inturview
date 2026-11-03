import { QuestionCategory } from "@prisma/client";
import { getAnthropic } from "./anthropic";
import { claudeCostUsd, type ClaudeUsage } from "./aiCost";
import { CATEGORY_LABELS, QuestionInputSchema, type QuestionInput } from "./questionBank";

/** Drafting is admin-only and low volume, so it uses the most capable model by default. */
export const DRAFT_MODEL = process.env.ANTHROPIC_DRAFT_MODEL || "claude-opus-5-5";

export interface DraftRequest {
  jobDescription: string;
  categories: QuestionCategory[];
  count: number;
  level: "junior" | "mid" | "senior" | null;
}

const CATEGORY_GUIDE: Record<QuestionCategory, string> = {
  RECRUITER_SCREEN: "a recruiter's first-call question: background, motivation, role fit, compensation expectations, logistics",
  BEHAVIORAL: "a 'tell me about a time' question the candidate answers with a real story (situation, actions, result)",
  TECHNICAL: "a spoken technical deep-dive question about concepts, trade-offs and experience; no live coding",
  CODING: "a self-contained coding problem with a precise statement, input/output examples and constraints",
  SYSTEM_DESIGN: "a 'design a system' question with clear scope and scale numbers",
};

export function buildDraftPrompt(req: DraftRequest): { system: string; user: string } {
  const kinds = req.categories.map((c) => `- ${c} (${CATEGORY_LABELS[c]}): ${CATEGORY_GUIDE[c]}`).join("\n");
  const system = `You write interview questions for a hiring platform. Questions are asked by an AI interviewer and graded against the signals you list.

Write original questions. Never copy questions from LeetCode, Glassdoor or other question banks.
Each question must be answerable in 10 to 15 minutes, specific to the role described, and free of anything that touches protected characteristics (age, family, health, religion, nationality and similar).

Reply with only a JSON array, no prose and no code fence. Each element:
{
  "category": one of ${req.categories.map((c) => `"${c}"`).join(", ")},
  "title": short name, under 80 characters,
  "prompt": the question exactly as the interviewer asks it,
  "followUps": 2 to 4 follow-up questions, each probing deeper than the last,
  "signals": 3 to 6 observable things a strong answer contains,
  "levels": ${req.level ? `["${req.level}"]` : `any of "junior", "mid", "senior" that fit`},
  "roles": role tags such as "backend" or "data", lowercase,
  "tags": 1 to 4 topic tags, lowercase,
  "difficulty": "Easy", "Medium", "Hard", or null for non-technical questions,
  "details": for CODING, {"examples": [{"input": "...", "output": "..."}], "constraints": ["..."]}; otherwise null
}`;
  const user = `Write ${req.count} question${req.count === 1 ? "" : "s"} for this role, spread across these categories:
${kinds}

Job description:
"""
${req.jobDescription.trim()}
"""`;
  return { system, user };
}

export interface ParsedDrafts {
  drafts: QuestionInput[];
  rejected: { index: number; reason: string }[];
}

/** Validates the model's reply field by field. Anything malformed is rejected, never saved half-broken. */
export function parseDrafts(text: string, allowed: QuestionCategory[]): ParsedDrafts {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return { drafts: [], rejected: [{ index: -1, reason: "Reply was not a JSON array" }] };
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { drafts: [], rejected: [{ index: -1, reason: "Reply was not valid JSON" }] };
  }
  if (!Array.isArray(raw)) return { drafts: [], rejected: [{ index: -1, reason: "Reply was not a JSON array" }] };

  const drafts: QuestionInput[] = [];
  const rejected: ParsedDrafts["rejected"] = [];
  raw.forEach((item, index) => {
    const parsed = QuestionInputSchema.safeParse(item);
    if (!parsed.success) {
      rejected.push({ index, reason: parsed.error.issues[0]?.message ?? "Invalid question" });
    } else if (!allowed.includes(parsed.data.category)) {
      rejected.push({ index, reason: `Category ${parsed.data.category} was not requested` });
    } else {
      drafts.push(parsed.data);
    }
  });
  return { drafts, rejected };
}

export async function generateDrafts(req: DraftRequest) {
  const { system, user } = buildDraftPrompt(req);
  const response = await getAnthropic().messages.create({
    model: DRAFT_MODEL,
    max_tokens: 8000,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const usage = response.usage as ClaudeUsage;
  return {
    ...parseDrafts(text, req.categories),
    stopReason: response.stop_reason,
    usage,
    costUsd: claudeCostUsd(DRAFT_MODEL, usage).costUsd,
  };
}
