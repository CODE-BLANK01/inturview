import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProblemForm, type ProblemFormValue } from "@/components/admin/ProblemForm";
import type { Difficulty } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditProblemPage({ params }: { params: { id: string } }) {
  const problem = await prisma.problem.findUnique({ where: { id: params.id } });
  if (!problem) notFound();

  const initial: ProblemFormValue = {
    id: problem.id,
    title: problem.title,
    difficulty: problem.difficulty as Difficulty,
    topic: problem.topic,
    leetcodeUrl: problem.leetcodeUrl,
    description: problem.description,
    examples: problem.examples as ProblemFormValue["examples"],
    constraints: problem.constraints as string[],
    optimalTime: problem.optimalTime,
    optimalSpace: problem.optimalSpace,
    tags: problem.tags as string[],
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Edit problem</h1>
        <p className="text-sm text-text-muted mt-1">
          Editing <span className="font-mono text-text">{problem.id}</span>. Slug
          is permanent.
        </p>
      </header>
      <ProblemForm mode="edit" problemId={problem.id} initial={initial} />
    </div>
  );
}
