import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — intervue" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  return (
    <AdminShell user={{ email: admin.email, name: admin.name }}>{children}</AdminShell>
  );
}
