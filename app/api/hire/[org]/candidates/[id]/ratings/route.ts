import { workspaceRoute } from "@/lib/hiring/routes";
import { rateHandler } from "@/lib/hiring/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = workspaceRoute<{ org: string; id: string }>("applications.review", (ctx, req, p) => rateHandler(ctx, req, p.id));
