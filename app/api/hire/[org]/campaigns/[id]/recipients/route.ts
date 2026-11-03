import { workspaceRoute } from "@/lib/hiring/routes";
import { addRecipientsHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = workspaceRoute<{ org: string; id: string }>("invitations.send", (ctx, req, p) => addRecipientsHandler(ctx, req, p.id));
