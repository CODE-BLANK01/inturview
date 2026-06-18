import { z } from "zod";

const DimensionSchema = z.object({
  score: z.number().min(0).max(5),
  max: z.literal(5),
  evidence: z.string(),
});

export const BehavioralDebriefSchema = z.object({
  overall_recommendation: z.enum([
    "Strong Hire",
    "Hire",
    "Lean Hire",
    "No Hire",
    "Strong No Hire",
  ]),
  scores: z.object({
    star_structure:    DimensionSchema,
    depth_of_example:  DimensionSchema,
    self_awareness:    DimensionSchema,
    impact:            DimensionSchema,
    communication:     DimensionSchema,
  }),
  total_score: z.number().min(0).max(25),
  max_score: z.literal(25),
  strengths: z.array(z.string()).min(1),
  improvements: z.array(z.string()).min(1),
  optimal_solution_notes: z.string().min(1),
  interviewer_summary: z.string().min(1),
});
export type BehavioralDebrief = z.infer<typeof BehavioralDebriefSchema>;

export const RecruiterDebriefSchema = z.object({
  overall_recommendation: z.enum([
    "Strong Advance",
    "Advance",
    "Lean Advance",
    "No Advance",
    "Strong No Advance",
  ]),
  scores: z.object({
    story_clarity:     DimensionSchema,
    motivation_fit:    DimensionSchema,
    compensation_savvy:DimensionSchema,
    role_alignment:    DimensionSchema,
    communication:     DimensionSchema,
  }),
  total_score: z.number().min(0).max(25),
  max_score: z.literal(25),
  strengths: z.array(z.string()).min(1),
  improvements: z.array(z.string()).min(1),
  optimal_solution_notes: z.string().min(1),
  interviewer_summary: z.string().min(1),
});
export type RecruiterDebrief = z.infer<typeof RecruiterDebriefSchema>;

export type ConversationDebrief = BehavioralDebrief | RecruiterDebrief;
