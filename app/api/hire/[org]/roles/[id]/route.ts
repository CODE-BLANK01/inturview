import { workspaceRoute } from "@/lib/hiring/routes";
import { updateRoleHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = workspaceRoute<{ org: string; id: string }>("roles.edit", (ctx, req, p) => updateRoleHandler(ctx, req, p.id));
