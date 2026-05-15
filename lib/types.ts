export type Difficulty = "Easy" | "Medium" | "Hard";

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  topic: string;
  leetcode_url: string;
  description: string;
  examples: { input: string; output: string }[];
  constraints: string[];
  optimal_time: string;
  optimal_space: string;
  tags: string[];
}

export type Phase = "approach" | "code" | "debrief";

export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface DimensionScore {
  score: number;
  max: number;
  evidence: string;
}

export interface Debrief {
  overall_recommendation: "Strong Hire" | "Hire" | "No Hire";
  scores: {
    problem_understanding: DimensionScore;
    approach_quality: DimensionScore;
    code_correctness: DimensionScore;
    complexity_awareness: DimensionScore;
    communication: DimensionScore;
  };
  total_score: number;
  max_score: number;
  strengths: string[];
  improvements: string[];
  optimal_solution_notes: string;
  interviewer_summary: string;
}

export interface CompletedSession {
  problem_id: string;
  completed_at: string;
  total_score: number;
  recommendation: Debrief["overall_recommendation"];
}
