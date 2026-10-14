import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { ROLE_LABELS } from "@/lib/permissions";
import { listMyWorkspaces } from "@/lib/workspaces";
import { requireHireUser } from "@/lib/workspaceGuard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hire — inturview", robots: { index: false } };

export default async function HirePicker() {
  const user = await requireHireUser("/hire");
  const workspaces = await listMyWorkspaces(user.id);
  if (workspaces.length === 1) redirect(`/hire/${workspaces[0].organization.slug}`);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="panel p-8 max-w-md w-full space-y-5">
        <h1 className="text-xl font-semibold">{workspaces.length ? "Choose a workspace" : "You're not in a hiring workspace"}</h1>
        {workspaces.length ? (
          <ul className="space-y-2">
            {workspaces.map((w) => (
              <li key={w.organization.slug}>
                <Link href={`/hire/${w.organization.slug}`} className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 hover:bg-bg-inset">
                  <Building2 className="h-4 w-4 text-text-dim" />
                  <span className="flex-1 text-sm font-medium truncate">{w.organization.name}</span>
                  <span className="text-xs text-text-dim">{ROLE_LABELS[w.role]}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">
            Workspaces are invitation-only while we work with design partners. If a teammate invited you, open the link in
            their email while signed in as {user.email}. Interested in hiring with inturview?{" "}
            <Link href="/employers" className="underline underline-offset-2">Talk to us</Link>.
          </p>
        )}
        <Link href="/dashboard" className="text-xs text-text-dim hover:text-text-muted">Back to practice</Link>
      </div>
    </main>
  );
}
