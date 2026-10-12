import { QuestionCategory } from "@prisma/client";
import { BEHAVIORAL_SCENARIOS } from "./behavioralScenarios";
import { DESIGN_PROBLEMS } from "./designProblems";
import { FACE_TO_FACE_QUESTIONS } from "./faceToFaceQuestions";
import { PROBLEMS } from "./problems";
import type { QuestionInput } from "./questionBank";

export interface SeedQuestion {
  sourceKey: string;
  input: QuestionInput;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Turns the questions hardcoded in lib/*.ts into question-bank rows. Pure; unit-tested. */
export function seedQuestions(): SeedQuestion[] {
  const behavioral = BEHAVIORAL_SCENARIOS.map((s) => ({
    sourceKey: `behavioral:${s.id}`,
    input: {
      category: QuestionCategory.BEHAVIORAL,
      title: s.title,
      prompt: s.prompt,
      followUps: [],
      signals: s.expectedSignals,
      levels: [],
      roles: [],
      tags: [slug(s.category)],
      difficulty: null,
      details: null,
    },
  }));

  const design = DESIGN_PROBLEMS.map((p) => ({
    sourceKey: `design:${p.id}`,
    input: {
      category: QuestionCategory.SYSTEM_DESIGN,
      title: p.title,
      prompt: p.prompt,
      followUps: p.deepDiveTopics,
      signals: [...p.expectedRequirements.functional, ...p.expectedRequirements.nonFunctional],
      levels: [],
      roles: [],
      tags: [slug(p.topic)],
      difficulty: p.difficulty,
      details: {
        expectedRequirements: p.expectedRequirements,
        referenceArchitecture: p.referenceArchitecture,
        estimatedDurationMinutes: p.estimatedDurationMinutes,
      },
    },
  }));

  const technical = FACE_TO_FACE_QUESTIONS.map((q) => ({
    sourceKey: `technical:${q.id}`,
    input: {
      category: QuestionCategory.TECHNICAL,
      title: q.opener.length > 80 ? `${q.opener.slice(0, 77)}…` : q.opener,
      prompt: q.opener,
      followUps: q.ladder,
      signals: q.signals,
      levels: [],
      roles: q.tracks.filter((t) => t !== "universal"),
      tags: [q.kind, ...(q.tracks.includes("universal") ? ["universal"] : [])],
      difficulty: null,
      details: null,
    },
  }));

  const coding = PROBLEMS.map((p) => ({
    sourceKey: `coding:${p.id}`,
    input: {
      category: QuestionCategory.CODING,
      title: p.title,
      prompt: p.description,
      followUps: [],
      signals: [`Reaches ${p.optimal_time} time`, `Uses ${p.optimal_space} extra space`],
      levels: [],
      roles: [],
      // Marked so employer loops can filter out externally sourced problems.
      tags: [...new Set([slug(p.topic), ...p.tags.map(slug), "external-leetcode"])],
      difficulty: p.difficulty,
      details: {
        examples: p.examples,
        constraints: p.constraints,
        optimalTime: p.optimal_time,
        optimalSpace: p.optimal_space,
        externalUrl: p.leetcode_url,
      },
    },
  }));

  return [...behavioral, ...design, ...technical, ...coding];
}
