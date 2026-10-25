import assert from "node:assert/strict";
import test from "node:test";
import { turnMetrics } from "../lib/speechMetrics";
import { newVoicePlan, readVoicePlan, voiceDeadlineMs, voiceMinutesUsed } from "../lib/voicePlan";
import { buildRealtimeSessionConfig } from "../lib/realtimeSession";
import {
  behavioralVoiceInstructions,
  behavioralVoiceOpening,
  behavioralDebriefSystemPrompt,
  recruiterDebriefSystemPrompt,
} from "../lib/conversationPrompts";
import { behavioralVoiceBrief, recruiterVoiceBrief } from "../lib/voiceInterviewer";
import { BEHAVIORAL_SCENARIOS } from "../lib/behavioralScenarios";

const scenario = BEHAVIORAL_SCENARIOS[0]!;

test("turn metrics count words, fillers, pace and the longest pause", () => {
  const m = turnMetrics("Um so basically I led the migration, you know, end to end.", 6000, [
    { start: 0, end: 2000 },
    { start: 3500, end: 6000 },
  ]);
  assert.equal(m.words, 12);
  assert.equal(m.filler_count, 3); // um, basically, you know
  assert.equal(m.filler_per_100_words, 25);
  assert.equal(m.wpm, 120);
  assert.equal(m.longest_pause_ms, 1500);
  assert.equal(m.segments, 2);
});

test("turn metrics without timing omit pace", () => {
  const m = turnMetrics("I owned the rollout.", null, null);
  assert.equal(m.wpm, undefined);
  assert.equal(m.duration_ms, undefined);
  assert.equal(m.segments, 1);
});

test("a voice plan round-trips and anything else reads as typed", () => {
  const plan = newVoicePlan("BEHAVIORAL", new Date("2026-10-20T10:00:00Z"));
  assert.deepEqual(readVoicePlan(JSON.parse(JSON.stringify(plan))), plan);
  assert.equal(readVoicePlan(null), null);
  assert.equal(readVoicePlan({ track: "backend", maxDurationSec: 1200 }), null);
});

test("the recruiter screen is a 25-minute call by default", () => {
  assert.equal(newVoicePlan("RECRUITER_SCREEN").maxDurationSec, 25 * 60);
  assert.equal(newVoicePlan("BEHAVIORAL").maxDurationSec, 15 * 60);
});

test("the recruiter opens the screen, not a generic interview question", () => {
  const brief = recruiterVoiceBrief([], 25 * 60);
  assert.match(brief.openingInstruction, /walk you through their background/);
  assert.match(brief.instructions, /Compensation/);
  const resumed = recruiterVoiceBrief([{ role: "user", content: "I'm at Acme now." }], 25 * 60);
  assert.match(resumed.openingInstruction, /reconnected/);
  assert.match(resumed.instructions, /CANDIDATE: I'm at Acme now\./);
});

test("voice minutes are measured from the voice start and capped", () => {
  const plan = { voice: true as const, maxDurationSec: 900, voiceStartedAt: "2026-10-20T10:00:00Z" };
  const start = new Date(plan.voiceStartedAt).getTime();
  assert.equal(voiceDeadlineMs(plan), start + 900_000);
  assert.equal(voiceMinutesUsed(plan, start + 5 * 60_000), 5);
  // Hours later still bills at most the cap plus the wrap-up grace.
  assert.equal(voiceMinutesUsed(plan, start + 5 * 3600_000), 17);
});

test("realtime session lets the browser decide when the interviewer replies", () => {
  const config = buildRealtimeSessionConfig({ instructions: "Be kind." });
  // No transcription prompt: the transcriber echoed it back as the candidate's words.
  assert.equal("prompt" in config.audio.input.transcription, false);
  assert.equal(config.audio.input.turn_detection.create_response, false);
  assert.equal(config.audio.input.turn_detection.interrupt_response, false);
  assert.deepEqual(config.output_modalities, ["audio"]);
  assert.match(config.instructions, /^LANGUAGE RULE/);
  assert.match(config.instructions, /Be kind\.$/);
});

test("reconnecting interviewer gets the prior conversation", () => {
  assert.doesNotMatch(behavioralVoiceInstructions(scenario), /reconnected/);
  const resumed = behavioralVoiceInstructions(scenario, [
    { role: "assistant", content: "Tell me about a conflict." },
    { role: "user", content: "At my last job a PM and I disagreed." },
  ]);
  assert.match(resumed, /CANDIDATE: At my last job/);
});

test("the first spoken turn names the scenario's question, not a generic opener", () => {
  const opening = behavioralVoiceOpening(scenario);
  assert.ok(opening.includes(scenario.prompt));
  assert.match(opening, /Do not ask them to introduce themselves/);
  const resumed = behavioralVoiceOpening(scenario, [{ role: "user", content: "We disagreed on scope." }]);
  assert.match(resumed, /reconnected/);
  assert.match(resumed, /CANDIDATE: We disagreed on scope\./);
});

test("the recruiter stays at recruiter depth and is paced through every section", () => {
  const brief = recruiterVoiceBrief([], 25 * 60);
  assert.match(brief.instructions, /NOT a\s+technical interview/);
  assert.match(brief.instructions, /Never ask about architecture, tech stacks/);
  // Background → motivation → comp → logistics → close, in order, inside the call.
  assert.deepEqual(brief.checkpoints.map((c) => Math.round(c.atSec / 60)), [8, 13, 18, 21]);
  assert.match(brief.checkpoints[1]!.note, /compensation/);
  // A shorter configured call scales the sections down with it.
  assert.ok(recruiterVoiceBrief([], 10 * 60).checkpoints.every((c) => c.atSec < 10 * 60));
});

test("debrief prompt adds delivery only for spoken sessions", () => {
  const transcript = [{ role: "user" as const, content: "I led it." }];
  assert.doesNotMatch(behavioralDebriefSystemPrompt(scenario, transcript), /This interview was spoken/);
  assert.match(
    behavioralDebriefSystemPrompt(scenario, transcript, { delivery: "avg 140 wpm" }),
    /This interview was spoken[\s\S]*avg 140 wpm/
  );
  assert.doesNotMatch(recruiterDebriefSystemPrompt(transcript), /This interview was spoken/);
  assert.match(recruiterDebriefSystemPrompt(transcript, { delivery: "avg 150 wpm" }), /avg 150 wpm/);
});

test("interviewer notes reach the debrief as data, only when the call produced them", () => {
  const transcript = [{ role: "user" as const, content: "One the best salad." }];
  const without = recruiterDebriefSystemPrompt(transcript, { delivery: "avg 150 wpm" });
  assert.doesNotMatch(without, /interviewer_notes/);
  const withNotes = recruiterDebriefSystemPrompt(transcript, {
    delivery: "avg 150 wpm",
    notes: "Compensation expectations: 150k to 250k, mostly base.",
  });
  assert.match(withNotes, /<interviewer_notes>\nCompensation expectations: 150k to 250k, mostly base\.\n<\/interviewer_notes>/);
  // Notes win over garbled lines, but unsupported claims aren't credited.
  assert.match(withNotes, /where the two conflict, go by the notes/);
  assert.match(withNotes, /no matching candidate line in the transcript/);
});

test("the notes request forbids invention and asks for each round's facts", () => {
  const recruiter = recruiterVoiceBrief([], 25 * 60).notesInstruction;
  assert.match(recruiter, /Never invent, guess or fill gaps/);
  assert.match(recruiter, /Compensation expectations:/);
  assert.match(recruiter, /Notice period:/);
  const behavioral = behavioralVoiceBrief(scenario, []).notesInstruction;
  assert.match(behavioral, /Task \(their own role\):/);
  assert.ok(behavioral.includes(scenario.prompt));
});

test("a stored plan keeps its notes, and malformed notes don't break the plan", () => {
  const base = { voice: true, maxDurationSec: 1500, voiceStartedAt: "2026-10-21T10:00:00Z" };
  assert.equal(readVoicePlan({ ...base, interviewerNotes: "Notice period: 30 days." })?.interviewerNotes, "Notice period: 30 days.");
  const malformed = readVoicePlan({ ...base, interviewerNotes: 42 });
  assert.ok(malformed);
  assert.equal("interviewerNotes" in malformed!, false);
});
