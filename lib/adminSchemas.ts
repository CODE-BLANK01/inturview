import { z } from "zod";

const ExampleSchema = z.object({
  input: z.string().min(1).max(2_000),
  output: z.string().min(1).max(2_000),
});

const ProblemFields = {
  id: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, digits, and hyphens"),
  title: z.string().min(1).max(200),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  topic: z.string().min(1).max(80),
  leetcodeUrl: z.string().url().or(z.literal("")).default(""),
  description: z.string().min(10).max(8_000),
  examples: z.array(ExampleSchema).min(1).max(8),
  constraints: z.array(z.string().min(1).max(400)).min(1).max(12),
  optimalTime: z.string().min(1).max(80),
  optimalSpace: z.string().min(1).max(80),
  tags: z.array(z.string().min(1).max(40)).max(12).default([]),
};

export const CreateProblemSchema = z.object(ProblemFields);

export const UpdateProblemSchema = z
  .object({
    title: ProblemFields.title.optional(),
    difficulty: ProblemFields.difficulty.optional(),
    topic: ProblemFields.topic.optional(),
    leetcodeUrl: ProblemFields.leetcodeUrl.optional(),
    description: ProblemFields.description.optional(),
    examples: ProblemFields.examples.optional(),
    constraints: ProblemFields.constraints.optional(),
    optimalTime: ProblemFields.optimalTime.optional(),
    optimalSpace: ProblemFields.optimalSpace.optional(),
    tags: ProblemFields.tags.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "No fields to update");

export const UpdateUserSchema = z.object({
  flagged: z.boolean().optional(),
  flagReason: z.string().max(500).nullable().optional(),
  disabled: z.boolean().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});
