import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: { page?: string; action?: string };
}) {
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const action = searchParams.action;

  const where = action ? { action } : undefined;
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        admin: { select: { email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-text-muted mt-1">
          Every admin mutation is recorded. Showing {entries.length} of {total} entries.
        </p>
      </header>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-text-dim">
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">When</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Admin</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Action</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Target</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-text-dim py-8">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-bg-surface/40">
                    <td className="px-4 py-2.5 text-xs text-text-dim whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-muted truncate max-w-[180px]">
                      {e.admin.email}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text">
                        {e.action.toLowerCase().replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-text-dim">
                      <span className="text-text-muted">{e.targetType}</span> · {e.targetId.slice(0, 18)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-text-dim truncate max-w-[320px]">
                      {e.metadata ? JSON.stringify(e.metadata) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={`?page=${page - 1}${action ? `&action=${action}` : ""}`} className="btn">
                Previous
              </a>
            )}
            {page < totalPages && (
              <a href={`?page=${page + 1}${action ? `&action=${action}` : ""}`} className="btn">
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
