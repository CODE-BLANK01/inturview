import { workspaceRoute } from "@/lib/hiring/routes";
import { draftQuestionsHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Drafting a handful of questions can take 20–60 seconds.
export const maxDuration = 60;

export const POST = workspaceRoute<{ org: string }>("questions.edit", (ctx, req) => draftQuestionsHandler(ctx, req));
