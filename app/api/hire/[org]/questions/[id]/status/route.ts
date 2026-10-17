import { workspaceRoute } from "@/lib/hiring/routes";
import { questionStatusHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = workspaceRoute<{ org: string; id: string }>("questions.edit", (ctx, req, p) => questionStatusHandler(ctx, req, p.id));
