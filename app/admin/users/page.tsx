import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UsersTable, type AdminUserRow } from "@/components/admin/UsersTable";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  filter?: "all" | "flagged" | "disabled" | "admin";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const admin = (await requireAdmin())!;

  const q = (searchParams.q ?? "").trim();
  const filter = searchParams.filter ?? "all";

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filter === "flagged") where.flagged = true;
  if (filter === "disabled") where.disabledAt = { not: null };
  if (filter === "admin") where.role = "ADMIN";

  const rows = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      flagged: true,
      flagReason: true,
      disabledAt: true,
      createdAt: true,
      _count: { select: { interviews: true } },
    },
  });

  const users: AdminUserRow[] = rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    flagged: u.flagged,
    flagReason: u.flagReason,
    disabledAt: u.disabledAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    interviewsCount: u._count.interviews,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-text-muted mt-1">
          Flag, disable, promote, or delete user accounts. All actions are written to the audit log.
        </p>
      </header>
      <UsersTable users={users} currentAdminId={admin.id} />
    </div>
  );
}
