import { notFound } from "next/navigation";
import { getProblem, PROBLEMS } from "@/lib/problems";
import { InterviewSession } from "@/components/InterviewSession";

export function generateStaticParams() {
  return PROBLEMS.map((p) => ({ id: p.id }));
}

export default function InterviewPage({ params }: { params: { id: string } }) {
  const problem = getProblem(params.id);
  if (!problem) notFound();
  return <InterviewSession problem={problem} />;
}
