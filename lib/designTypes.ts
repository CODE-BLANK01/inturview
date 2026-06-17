import { z } from "zod";

const DimensionSchema = z.object({
  score: z.number().min(0).max(5),
  max: z.literal(5),
  evidence: z.string(),
});

export const DesignDebriefSchema = z.object({
  overall_recommendation: z.enum([
    "Strong Hire",
    "Hire",
    "Lean Hire",
    "No Hire",
    "Strong No Hire",
  ]),
  scores: z.object({
    requirements_clarity: DimensionSchema,
    architecture_design: DimensionSchema,
    scalability: DimensionSchema,
    tradeoff_reasoning: DimensionSchema,
    communication: DimensionSchema,
  }),
  total_score: z.number().min(0).max(25),
  max_score: z.literal(25),
  strengths: z.array(z.string()).min(1),
  improvements: z.array(z.string()).min(1),
  optimal_solution_notes: z.string().min(1),
  interviewer_summary: z.string().min(1),
});
export type DesignDebrief = z.infer<typeof DesignDebriefSchema>;
