/**
 * Prompts for the live face-to-face technical round.
 *
 * The realtime interviewer instructions are consumed by the OpenAI Realtime
 * session (speech-to-speech); the debrief + follow-up prompts run on Claude
 * like every other mode, over the persisted text transcript.
 */

import {
  getFaceToFaceQuestion,
  LEVEL_LABELS,
  TRACK_LABELS,
  type FaceToFaceLevel,
  type FaceToFacePlan,
  type FaceToFaceQuestion,
} from "./faceToFaceQuestions";

interface TranscriptTurn {
  role: "user" | "assistant";
  content: string;
  metrics?: TurnMetrics | null;
}

export interface BodyMetrics {
  frames?: number;
  face_visible_ratio?: number;
  eye_contact_ratio?: number;
  look_away_count?: number;
  upright_ratio?: number;
  restless_ratio?: number;
  hand_near_face_ratio?: number;
  smile_ratio?: number;
  brow_furrow_ratio?: number;
}

export interface TurnMetrics {
  words?: number;
  duration_ms?: number;
  wpm?: number;
  filler_count?: number;
  filler_per_100_words?: number;
  longest_pause_ms?: number;
  segments?: number;
  body?: BodyMetrics | null;
}

function planQuestions(plan: FaceToFacePlan): FaceToFaceQuestion[] {
  return plan.questionIds
    .map((id) => getFaceToFaceQuestion(id))
    .filter((q): q is FaceToFaceQuestion => Boolean(q));
}

function levelGuidance(level: FaceToFaceLevel): string {
  switch (level) {
    case "junior":
      return `Level calibration — JUNIOR:
- Climb at most two rungs of any ladder. Fundamentals matter more than trade-offs.
- Be warm. If they stall, offer one small nudge, then move on.`;
    case "mid":
      return `Level calibration — MID:
- Climb the full ladder. Expect trade-offs to be named without prompting.
- Push "why" once on every design choice they mention.`;
    case "senior":
      return `Level calibration — SENIOR:
- Fewer questions, deeper. End every ladder with: what's the failure mode, what does it cost at scale, what would you do differently now.
- The scenario is the centrepiece. Expect them to ask clarifying questions before answering.`;
  }
}

export function faceToFaceInterviewerInstructions(
  plan: FaceToFacePlan,
  priorTranscript: TranscriptTurn[] = []
): string {
  const questions = planQuestions(plan);
  const fundamentals = questions.filter((q) => q.kind === "fundamental");
  const scenario = questions.find((q) => q.kind === "scenario");
  const minutes = Math.round(plan.maxDurationSec / 60);

  const fundamentalsBlock = fundamentals
    .map(
      (q, i) =>
        `   Q${i + 1}: ${q.opener}\n${q.ladder.map((r, j) => `      rung ${j + 1}: ${r}`).join("\n")}`
    )
    .join("\n");

  const scenarioBlock = scenario
    ? `   ${scenario.opener}\n${scenario.ladder.map((r, j) => `      rung ${j + 1}: ${r}`).join("\n")}`
    : "   (no scenario selected)";

  const resumeBlock =
    priorTranscript.length > 0
      ? `

The session was interrupted and is resuming. Transcript so far:
${priorTranscript.map((t) => `${t.role === "assistant" ? "YOU" : "CANDIDATE"}: ${t.content}`).join("\n")}

Pick up naturally from where it left off. Do not re-ask questions already answered.`
      : "";

  return `You are a senior software engineer running a live, spoken, face-to-face technical interview.
Track: ${TRACK_LABELS[plan.track]}. Candidate level: ${LEVEL_LABELS[plan.level]}. Time budget: ${minutes} minutes.

This is a VOICE conversation over video. Speak naturally in short turns — one to three sentences. One question at a time. Never read lists or bullet points aloud. Never break character. Never say you are an AI.

Interview arc:
1. Warm-up (~2 min). Greet briefly by saying you're glad they could make it, then ask: "Walk me through the most technically interesting thing you've built recently."
2. Project deep-dive (~6 min). Pull threads from their answer: why that choice, what broke, how they found it, what they'd change now. Push "we" to "I". Push buzzwords to mechanisms.
3. Fundamentals (~6 min). Ask these in order. Climb one rung at a time. When the candidate hits the edge of what they know, acknowledge briefly and move on — do not teach.
${fundamentalsBlock}
4. Applied scenario (~4 min). Let them reason out loud; poke at the gaps.
${scenarioBlock}
5. Wrap (~1 min). Ask "Anything you'd want to add, or any questions for me?" Answer briefly, thank them, and say clearly that the interview is over.

Rules:
- The candidate should be talking about seventy percent of the time. Your turns are short.
- If an answer is vague, ask for the specific mechanism or a concrete example. Once. Then move on.
- Do not give hints, corrections, or praise during the interview. A brief "okay" or "got it" is enough.
- If a candidate turn is unintelligible or sounds like background noise, say "Sorry, I didn't catch that — could you say it again?" Do not guess at what they said.
- If you receive a note in square brackets about time, follow it immediately.

${levelGuidance(plan.level)}${resumeBlock}`;
}

export const FACE_TO_FACE_DEBRIEF_SCHEMA = `{
  "overall_recommendation": "Strong Hire | Hire | Lean Hire | No Hire | Strong No Hire",
  "scores": {
    "technical_depth": { "score": <1-5>, "max": 5, "evidence": "<one sentence>" },
    "problem_solving": { "score": <1-5>, "max": 5, "evidence": "<one sentence>" },
    "clarity":         { "score": <1-5>, "max": 5, "evidence": "<one sentence>" },
    "delivery":        { "score": <1-5>, "max": 5, "evidence": "<one sentence>" },
    "body_language":   { "score": <1-5>, "max": 5, "evidence": "<one sentence>" }
  },
  "total_score": <sum of the 5 scores>,
  "max_score": 25,
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "optimal_solution_notes": "<3-5 sentences on what strong answers to this session's questions contain>",
  "interviewer_summary": "<2-3 sentence summary as if written in a hiring committee doc>"
}`;

function fmt(n: number | undefined, digits = 0): string {
  return n === undefined || Number.isNaN(n) ? "–" : n.toFixed(digits);
}

export function summarizeDeliveryMetrics(transcript: TranscriptTurn[]): string {
  const turns = transcript.filter((t) => t.role === "user" && t.metrics);
  if (turns.length === 0) return "(no delivery metrics captured)";

  const rows = turns.map((t, i) => {
    const m = t.metrics!;
    return `  ${i + 1}. ${fmt(m.words)} words · ${fmt((m.duration_ms ?? 0) / 1000, 1)}s · ${fmt(m.wpm)} wpm · ${fmt(m.filler_count)} fillers · longest pause ${fmt((m.longest_pause_ms ?? 0) / 1000, 1)}s`;
  });

  const totalWords = turns.reduce((a, t) => a + (t.metrics!.words ?? 0), 0);
  const totalMs = turns.reduce((a, t) => a + (t.metrics!.duration_ms ?? 0), 0);
  const totalFillers = turns.reduce((a, t) => a + (t.metrics!.filler_count ?? 0), 0);
  const avgWpm = totalMs > 0 ? totalWords / (totalMs / 60000) : undefined;
  const fillerRate = totalWords > 0 ? (totalFillers / totalWords) * 100 : undefined;

  return `Per answer:
${rows.join("\n")}
Session: ${turns.length} answers · ${totalWords} words · ${fmt(totalMs / 1000)}s speaking · avg ${fmt(avgWpm)} wpm · ${fmt(fillerRate, 1)} fillers per 100 words

Reference: conversational technical answers land around 130–170 wpm; under 110 reads hesitant, over 190 reads rushed. Under 2 fillers per 100 words is clean; over 6 is distracting.`;
}

function pct(n: number | undefined): string {
  return n === undefined || Number.isNaN(n) ? "–" : `${Math.round(n * 100)}%`;
}

export function summarizeBodyLanguage(transcript: TranscriptTurn[]): string {
  const turns = transcript.filter((t) => t.role === "user" && t.metrics?.body?.frames);
  if (turns.length === 0) return "(no body-language data captured — camera tracking was unavailable)";

  const bodies = turns.map((t) => t.metrics!.body!);
  const totalFrames = bodies.reduce((a, b) => a + (b.frames ?? 0), 0);
  const weighted = (key: keyof BodyMetrics) =>
    totalFrames > 0
      ? bodies.reduce((a, b) => a + ((b[key] as number | undefined) ?? 0) * (b.frames ?? 0), 0) /
        totalFrames
      : undefined;
  const lookAways = bodies.reduce((a, b) => a + (b.look_away_count ?? 0), 0);

  const rows = bodies.map(
    (b, i) =>
      `  ${i + 1}. eye contact ${pct(b.eye_contact_ratio)} · upright ${pct(b.upright_ratio)} · restless ${pct(b.restless_ratio)} · hands near face ${pct(b.hand_near_face_ratio)} · look-aways ${b.look_away_count ?? 0}`
  );

  return `Per answer (measured by on-device camera tracking, calibrated to where the candidate's camera sits):
${rows.join("\n")}
Session: eye contact ${pct(weighted("eye_contact_ratio"))} of the time · in frame ${pct(weighted("face_visible_ratio"))} · upright posture ${pct(weighted("upright_ratio"))} · restless movement ${pct(weighted("restless_ratio"))} · hands near face ${pct(weighted("hand_near_face_ratio"))} · smiling ${pct(weighted("smile_ratio"))} · brow furrowed ${pct(weighted("brow_furrow_ratio"))} · ${lookAways} sustained look-aways

Reference: strong candidates hold camera eye contact 60–80% of the time while speaking (looking away briefly to think is normal — near 100% reads as staring); upright posture above 80%; restless movement under 15%; hands near the face under 10%. These are observed behaviours, not a judgment of the person — describe what was seen and what to change, never diagnose confidence or emotion.`;
}

export function faceToFaceDebriefSystemPrompt(
  plan: FaceToFacePlan,
  transcript: TranscriptTurn[]
): string {
  const questions = planQuestions(plan);
  const t = transcript
    .map((m) => `${m.role === "assistant" ? "INTERVIEWER" : "CANDIDATE"}: ${m.content}`)
    .join("\n");

  const signalsBlock = questions
    .map((q) => `- ${q.opener}\n${q.signals.map((s) => `    • ${s}`).join("\n")}`)
    .join("\n");

  return `You are completing the debrief for a live, spoken face-to-face technical interview.

Track: ${TRACK_LABELS[plan.track]}
Candidate level: ${LEVEL_LABELS[plan.level]}

Questions planned for this session, with the signals a strong answer contains (reference — the candidate never saw these):
${signalsBlock}

Full transcript (speech-to-text; minor transcription noise is normal and must not be held against the candidate):
${t || "(no transcript captured)"}

Delivery metrics measured from the candidate's audio:
${summarizeDeliveryMetrics(transcript)}

Body language measured from the candidate's camera:
${summarizeBodyLanguage(transcript)}

Return ONLY valid JSON matching this exact schema. No markdown fences, no preamble, no commentary outside the JSON:

${FACE_TO_FACE_DEBRIEF_SCHEMA}

Scoring rubric (1-5 each):
- technical_depth:  did they explain mechanisms, not just names? How far down each ladder did they get before hitting the edge, relative to their level?
- problem_solving:  on the scenario and the deep-dive, did they reason from evidence, ask clarifying questions, weigh trade-offs, and stay steady at the edge of their knowledge — saying "I don't know" cleanly and recovering?
- clarity:          could a colleague follow the answer on first hearing? Did answers get tighter or more tangled as they went?
- delivery:         use the measured audio metrics — pace, fillers, pauses. Cite the numbers in the evidence.
- body_language:    use the measured camera metrics — eye contact, posture, restlessness, hands near face. Cite the numbers and name the one behaviour most worth changing. If no body-language data was captured, score 3 and write exactly "Not measured this session." as the evidence.

Be honest. 3 = meets bar for the stated level, 4 = above bar, 5 = exceptional. Don't give everyone 5s.

Overall recommendation — 5 bands (use total as a GUIDELINE, adjust ±1 band on qualitative signal):
- Strong Hire:     22–25
- Hire:            18–21
- Lean Hire:       13–17
- No Hire:          8–12
- Strong No Hire:   0–7`;
}

export function faceToFaceFollowUpSystemPrompt(plan: FaceToFacePlan): string {
  const questions = planQuestions(plan);
  return `You are debriefing with a candidate after their live face-to-face technical interview (${TRACK_LABELS[plan.track]}, ${LEVEL_LABELS[plan.level]}).
The interview is OVER. You can speak freely and educationally now.

The questions asked were:
${questions.map((q) => `- ${q.opener}`).join("\n")}

You can walk through what a top-tier answer to each looks like, explain the mechanisms they missed, and give concrete advice on spoken delivery — pacing, cutting filler words, handling "I don't know" moments — and on body language on camera: holding the lens, posture, keeping hands away from the face. Be helpful, concise, clear. Plain text.`;
}
