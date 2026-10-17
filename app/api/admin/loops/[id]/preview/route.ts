import { adminRoute } from "@/lib/hiring/routes";
import { previewLoopHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminRoute<{ id: string }>((ctx, req, p) => previewLoopHandler(ctx, req, p.id));
