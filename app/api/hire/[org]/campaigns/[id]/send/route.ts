import { workspaceRoute } from "@/lib/hiring/routes";
import { sendBatchHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const POST = workspaceRoute<{ org: string; id: string }>("invitations.send", (ctx, req, p) => sendBatchHandler(ctx, req, p.id));
