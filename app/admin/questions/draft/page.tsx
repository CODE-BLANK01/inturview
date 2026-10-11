import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { QuestionDraftForm } from "@/components/admin/QuestionDraftForm";

export const metadata = { title: "Draft questions with AI — inturview admin" };

export default function DraftQuestionsPage() {
  return (
    <div className="space-y-6">
      <Link href="/admin/questions" className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-3.5 w-3.5" /> Questions
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Draft questions with AI</h1>
        <p className="text-sm text-text-muted mt-1">
          Paste a job description and get original questions written for that role. Everything lands as a draft for you
          to edit and publish.
        </p>
      </header>
      <QuestionDraftForm />
    </div>
  );
}
