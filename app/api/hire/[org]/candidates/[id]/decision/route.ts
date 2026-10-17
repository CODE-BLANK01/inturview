import { workspaceRoute } from "@/lib/hiring/routes";
import { decideHandler } from "@/lib/hiring/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = workspaceRoute<{ org: string; id: string }>("applications.decide", (ctx, req, p) => decideHandler(ctx, req, p.id));
