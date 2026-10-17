import { workspaceRoute } from "@/lib/hiring/routes";
import { createRoleHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = workspaceRoute<{ org: string }>("roles.edit", (ctx, req) => createRoleHandler(ctx, req));
