import { ProblemForm } from "@/components/admin/ProblemForm";

export const metadata = { title: "New problem — admin" };

export default function NewProblemPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New problem</h1>
        <p className="text-sm text-text-muted mt-1">
          Add a problem to the catalog. Slugs are stable forever once created.
        </p>
      </header>
      <ProblemForm mode="create" />
    </div>
  );
}
