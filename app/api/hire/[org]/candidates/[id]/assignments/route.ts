import { workspaceRoute } from "@/lib/hiring/routes";
import { assignHandler, unassignHandler } from "@/lib/hiring/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = workspaceRoute<{ org: string; id: string }>("reviewers.assign", (ctx, req, p) => assignHandler(ctx, req, p.id));
export const DELETE = workspaceRoute<{ org: string; id: string }>("reviewers.assign", (ctx, req, p) => unassignHandler(ctx, req, p.id));
