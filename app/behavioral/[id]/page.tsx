import { notFound } from "next/navigation";
import { BEHAVIORAL_SCENARIOS, getBehavioralScenario } from "@/lib/behavioralScenarios";
import { ConversationSession } from "@/components/ConversationSession";

export function generateStaticParams() {
  return BEHAVIORAL_SCENARIOS.map((s) => ({ id: s.id }));
}

export default function BehavioralSessionPage({
  params,
}: {
  params: { id: string };
}) {
  const scenario = getBehavioralScenario(params.id);
  if (!scenario) notFound();
  return (
    <ConversationSession
      kind="BEHAVIORAL"
      scenarioId={scenario.id}
      title={scenario.title}
      subtitle={scenario.category}
      prompt={scenario.prompt}
      backHref="/behavioral"
      backLabel="Scenarios"
    />
  );
}
