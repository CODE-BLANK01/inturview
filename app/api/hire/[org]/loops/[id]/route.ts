import { workspaceRoute } from "@/lib/hiring/routes";
import { updateLoopHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = workspaceRoute<{ org: string; id: string }>("loops.edit", (ctx, req, p) => updateLoopHandler(ctx, req, p.id));
