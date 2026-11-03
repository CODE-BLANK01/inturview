import { workspaceRoute } from "@/lib/hiring/routes";
import { rescoreHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = workspaceRoute<{ org: string; id: string }>("applications.rescore", (ctx, _req, p) => rescoreHandler(ctx, p.id));
