/**
 * Behavioral interview seed scenarios. The static list is the source of
 * truth; `prisma/seedBehavioral.ts` upserts into the DB.
 *
 * Each scenario opens with one canonical question; the LLM is responsible
 * for STAR-method probing on top of that. `expectedSignals` is fed to the
 * debrief route as a grading reference.
 */

export interface BehavioralScenarioDef {
  id: string;
  title: string;
  /** "Conflict" / "Failure" / "Leadership" / "Ambiguity" / "Growth" / "Communication" */
  category: string;
  prompt: string;
  /** Specific behaviors the debrief should look for. Used in grading only. */
  expectedSignals: string[];
}

export const BEHAVIORAL_CATEGORIES = [
  "Conflict",
  "Failure",
  "Leadership",
  "Ambiguity",
  "Growth",
  "Communication",
] as const;

export const BEHAVIORAL_SCENARIOS: BehavioralScenarioDef[] = [
  {
    id: "conflict-with-teammate",
    title: "Conflict with a teammate",
    category: "Conflict",
    prompt:
      "Tell me about a time you had a serious disagreement with a teammate. What was the situation, and how did you handle it?",
    expectedSignals: [
      "Names a specific concrete incident (not a generality)",
      "Owns their part of the conflict rather than blaming",
      "Describes how they sought to understand the other side",
      "Shows the resolution and what changed afterwards",
      "Reflects on what they learned",
    ],
  },
  {
    id: "biggest-failure",
    title: "Your biggest failure",
    category: "Failure",
    prompt:
      "Walk me through a project that didn't go well. What happened, what was your role, and what did you learn?",
    expectedSignals: [
      "Picks a real, meaningful failure (not a humblebrag)",
      "Takes accountability without over-apologizing",
      "Articulates root cause beyond surface symptoms",
      "Concrete behavior changes they made afterwards",
      "Evidence the lesson stuck (later situation handled differently)",
    ],
  },
  {
    id: "leadership-without-authority",
    title: "Leading without authority",
    category: "Leadership",
    prompt:
      "Tell me about a time you had to drive an outcome through people who didn't report to you. How did you build buy-in?",
    expectedSignals: [
      "Mapped stakeholders and their incentives",
      "Adapted communication style per audience",
      "Built coalition rather than going top-down",
      "Concrete outcome metric tied to the influence",
      "Self-aware about what didn't work and why",
    ],
  },
  {
    id: "ambiguous-problem",
    title: "An ambiguous problem",
    category: "Ambiguity",
    prompt:
      "Tell me about a time you were given a vague, open-ended problem. How did you decide what to actually work on?",
    expectedSignals: [
      "Structured approach to scoping (interviews, data, hypotheses)",
      "Made the implicit explicit — wrote down assumptions",
      "Picked a sharp first cut rather than analysis paralysis",
      "Iterated based on signal, not just opinion",
      "Communicated scope changes to stakeholders early",
    ],
  },
  {
    id: "disagree-and-commit",
    title: "Disagree and commit",
    category: "Conflict",
    prompt:
      "Tell me about a time you strongly disagreed with a decision but had to commit to it anyway. How did you handle that?",
    expectedSignals: [
      "Made the case strongly before the decision",
      "Once decided, executed without sabotaging",
      "Shielded their team from their own disagreement",
      "Set checkpoints to revisit if data changed",
      "Reflects honestly on whether they were right or wrong",
    ],
  },
  {
    id: "tight-deadline",
    title: "An impossibly tight deadline",
    category: "Ambiguity",
    prompt:
      "Tell me about a time you had a deadline that felt impossible. What did you cut, what did you keep, and how did you communicate?",
    expectedSignals: [
      "Triaged ruthlessly — named what got cut",
      "Surfaced the trade-off to stakeholders early",
      "Protected quality on the things that shipped",
      "Specific mechanism for managing the team's stress / hours",
      "Honest post-mortem on whether the deadline was the right call",
    ],
  },
  {
    id: "feedback-you-received",
    title: "Hard feedback you received",
    category: "Growth",
    prompt:
      "Tell me about the most uncomfortable piece of feedback you've gotten in your career. What was it, and what did you do about it?",
    expectedSignals: [
      "Picks real critical feedback, not a soft one",
      "Doesn't get defensive in the retelling",
      "Specific behavior change with timeline",
      "Evidence the change held (later moment where it would have shown up)",
      "Self-awareness about why the feedback was hard to hear",
    ],
  },
  {
    id: "explain-technical",
    title: "Explaining technical work to non-engineers",
    category: "Communication",
    prompt:
      "Tell me about a time you had to explain something technical to a non-technical audience — execs, sales, customers. How did you approach it?",
    expectedSignals: [
      "Read the audience's mental model before talking",
      "Used analogy / metaphor rather than jargon",
      "Anchored on the business outcome, not the implementation",
      "Asked questions to confirm understanding",
      "Adjusted in real time based on signals",
    ],
  },
];

export function getBehavioralScenario(
  id: string
): BehavioralScenarioDef | undefined {
  return BEHAVIORAL_SCENARIOS.find((s) => s.id === id);
}
