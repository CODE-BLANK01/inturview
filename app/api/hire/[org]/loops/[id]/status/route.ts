import { workspaceRoute } from "@/lib/hiring/routes";
import { loopStatusHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = workspaceRoute<{ org: string; id: string }>("loops.edit", (ctx, req, p) => loopStatusHandler(ctx, req, p.id));
