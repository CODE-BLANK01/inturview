import { workspaceRoute } from "@/lib/hiring/routes";
import { addNoteHandler } from "@/lib/hiring/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = workspaceRoute<{ org: string; id: string }>("applications.review", (ctx, req, p) => addNoteHandler(ctx, req, p.id));
