import {
  LoopSchema,
  type LoopRepository,
  type LoopInput,
  type LoopRound,
  type InterviewLoop,
} from "./loop";

const template: Array<Pick<LoopRound, "mode" | "title" | "focus">> = [
  {
    mode: "recruiter",
    title: "Your story and this role",
    focus: "Connect your experience with the opportunity.",
  },
  {
    mode: "behavioral",
    title: "Ownership under pressure",
    focus: "Explain a decision, your contribution, and its outcome.",
  },
  {
    mode: "coding",
    title: "Reason through a problem",
    focus: "Communicate an approach, its complexity, and edge cases.",
  },
  {
    mode: "design",
    title: "Make the trade-offs explicit",
    focus: "Describe scale, reliability, and what you would simplify.",
  },
];

export function createMockLoopRepository(ownerId: string): LoopRepository {
  const key = (id: string) => `inturview:loop-preview:v1:${ownerId}:${id}`;
  const save = async (loop: InterviewLoop) => {
    try {
      sessionStorage.setItem(
        key(loop.id),
        JSON.stringify(LoopSchema.parse(loop)),
      );
    } catch {
      throw new Error(
        "This preview needs tab storage. Allow session storage and try again; no interview has been charged.",
      );
    }
  };
  return {
    kind: "mock",
    async *generate(input: LoopInput, signal: AbortSignal) {
      const isFrontend = /frontend|front.end|react|interface/i.test(
        input.jobPost,
      );
      for (const [index, entry] of template.entries()) {
        if (signal.aborted) return;
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            signal.removeEventListener("abort", finish);
            resolve();
          };
          const timer = setTimeout(finish, 240);
          signal.addEventListener("abort", finish, { once: true });
        });
        if (signal.aborted) return;
        yield {
          ...entry,
          title:
            entry.mode === "coding" && isFrontend
              ? "Reason about interface state"
              : entry.title,
          id: `round-${index + 1}`,
          status: index === 0 ? "available" : "locked",
        };
      }
    },
    async create(input, rounds) {
      if (!rounds.length)
        throw new Error("Keep at least one round in the plan.");
      const loop: InterviewLoop = {
        id: crypto.randomUUID(),
        role:
          input.jobPost
            .split("\n")
            .find((line) => line.trim())
            ?.trim()
            .slice(0, 100) || "Your target role",
        interviewDate: input.interviewDate,
        rounds: rounds.map((round, index) => ({
          ...round,
          status: index === 0 ? "available" : "locked",
        })),
        notes: [],
        createdAt: new Date().toISOString(),
      };
      await save(loop);
      return loop;
    },
    async get(id) {
      try {
        const raw = sessionStorage.getItem(key(id));
        if (!raw) return null;
        const parsed = LoopSchema.safeParse(JSON.parse(raw));
        return parsed.success && parsed.data.id === id ? parsed.data : null;
      } catch {
        throw new Error(
          "This preview could not read tab storage. Allow session storage and try again.",
        );
      }
    },
    save,
  };
}
