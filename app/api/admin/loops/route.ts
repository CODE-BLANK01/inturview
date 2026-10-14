import { adminRoute } from "@/lib/hiring/routes";
import { createLoopHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminRoute((ctx, req) => createLoopHandler(ctx, req));
