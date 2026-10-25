/**
 * Who the spoken interviewer is, per round: its session instructions, its
 * first line, its pacing checkpoints and its end-of-call notes. The voice-key route
 * bakes these into the OpenAI key, so the browser can't change them.
 */

import type { BehavioralScenarioDef } from "./behavioralScenarios";
import {
  behavioralVoiceInstructions,
  behavioralVoiceNotesInstruction,
  behavioralVoiceOpening,
  recruiterVoiceInstructions,
  recruiterVoiceNotesInstruction,
  recruiterVoiceOpening,
} from "./conversationPrompts";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

/** A note the interviewer gets at a set point in the call, to keep it on pace. */
export interface VoiceCheckpoint {
  /** Seconds into the call. */
  atSec: number;
  note: string;
}

export interface VoiceBrief {
  instructions: string;
  openingInstruction: string;
  checkpoints: VoiceCheckpoint[];
  /** Instruction for the hidden end-of-call notes request. */
  notesInstruction: string;
}

/**
 * Section changes for the recruiter screen, as fractions of the call (8, 13,
 * 18 and 21 minutes of 25). Without them the model keeps pulling on the
 * first thread and never reaches compensation or logistics.
 */
const RECRUITER_SECTIONS: { at: number; note: string }[] = [
  { at: 8 / 25, note: "Time check: wrap up their background and move on to motivation (why they're looking now)." },
  { at: 13 / 25, note: "Time check: move on to compensation expectations." },
  { at: 18 / 25, note: "Time check: move on to logistics (work authorization, location, notice period)." },
  { at: 21 / 25, note: "Time check: ask if they have questions for you, then start closing the call." },
];

export function recruiterVoiceBrief(prior: Turn[], maxDurationSec: number): VoiceBrief {
  return {
    instructions: recruiterVoiceInstructions(prior),
    openingInstruction: recruiterVoiceOpening(prior),
    checkpoints: RECRUITER_SECTIONS.map((s) => ({
      atSec: Math.round(s.at * maxDurationSec),
      note: s.note,
    })),
    notesInstruction: recruiterVoiceNotesInstruction(),
  };
}

export function behavioralVoiceBrief(scenario: BehavioralScenarioDef, prior: Turn[]): VoiceBrief {
  return {
    instructions: behavioralVoiceInstructions(scenario, prior),
    openingInstruction: behavioralVoiceOpening(scenario, prior),
    // One story, one thread: the closing time warning is enough.
    checkpoints: [],
    notesInstruction: behavioralVoiceNotesInstruction(scenario),
  };
}
