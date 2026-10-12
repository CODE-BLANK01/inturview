import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { QuestionForm } from "@/components/admin/QuestionForm";

export const metadata = { title: "New question — inturview admin" };

export default function NewQuestionPage() {
  return (
    <div className="space-y-6">
      <Link href="/admin/questions" className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-3.5 w-3.5" /> Questions
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New question</h1>
        <p className="text-sm text-text-muted mt-1">Saved as a draft. Publish it when it&apos;s ready for loops.</p>
      </header>
      <QuestionForm />
    </div>
  );
}
