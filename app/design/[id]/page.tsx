import { notFound } from "next/navigation";
import { DESIGN_PROBLEMS, getDesignProblem } from "@/lib/designProblems";
import { DesignSession } from "@/components/DesignSession";

export function generateStaticParams() {
  return DESIGN_PROBLEMS.map((p) => ({ id: p.id }));
}

export default function DesignPage({ params }: { params: { id: string } }) {
  const problem = getDesignProblem(params.id);
  if (!problem) notFound();
  return <DesignSession problem={problem} />;
}
