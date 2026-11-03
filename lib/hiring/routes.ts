// Wraps a shared hiring handler as an Admin or a workspace route.
import type { NextRequest } from "next/server";
import { requireAdmin } from "../auth";
import type { Permission } from "../permissions";
import { workspaceApi } from "../workspaceGuard";
import { accessAllows } from "../workspaces";
import type { HiringCtx } from "./handlers";

type Handler<P> = (ctx: HiringCtx, req: NextRequest, params: P) => Promise<Response>;

/** The platform library: operators only, organizationId null. */
export function adminRoute<P = Record<string, never>>(handler: Handler<P>) {
  return async (req: NextRequest, { params }: { params: P }) => {
    const admin = await requireAdmin();
    if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
    return handler({ organizationId: null, actorId: admin.id }, req, params);
  };
}

/** A workspace route: the org comes from the URL slug and the caller's membership, never the body. */
export function workspaceRoute<P extends { org: string }>(permission: Permission, handler: Handler<P>) {
  return async (req: NextRequest, { params }: { params: P }) => {
    const guard = await workspaceApi(params.org, permission);
    if (!guard.ok) return guard.response;
    return handler(
      { organizationId: guard.access.org.id, actorId: guard.user.id, canViewAll: accessAllows(guard.access, "applications.viewAll") },
      req,
      params,
    );
  };
}
