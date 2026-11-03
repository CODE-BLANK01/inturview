import { workspaceRoute } from "@/lib/hiring/routes";
import { createCampaignHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = workspaceRoute<{ org: string }>("invitations.send", (ctx, req) => createCampaignHandler(ctx, req));
