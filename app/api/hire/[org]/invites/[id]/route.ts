import { workspaceRoute } from "@/lib/hiring/routes";
import { inviteActionHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = workspaceRoute<{ org: string; id: string }>("invitations.send", (ctx, req, p) => inviteActionHandler(ctx, req, p.id));
