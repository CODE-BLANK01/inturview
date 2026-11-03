import { adminRoute } from "@/lib/hiring/routes";
import { updateLoopHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = adminRoute<{ id: string }>((ctx, req, p) => updateLoopHandler(ctx, req, p.id));
