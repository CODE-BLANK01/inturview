import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewLoopForm } from "@/components/admin/NewLoopForm";

export const metadata = { title: "New loop — inturview admin" };

export default function NewLoopPage() {
  return (
    <div className="space-y-6">
      <Link href="/admin/loops" className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-3.5 w-3.5" /> Loops
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New loop</h1>
        <p className="text-sm text-text-muted mt-1">Name it now; you&apos;ll add rounds on the next screen.</p>
      </header>
      <NewLoopForm />
    </div>
  );
}
