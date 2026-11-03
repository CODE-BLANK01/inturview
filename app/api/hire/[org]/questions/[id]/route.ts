import { workspaceRoute } from "@/lib/hiring/routes";
import { getQuestion, updateQuestionHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = workspaceRoute<{ org: string; id: string }>("questions.edit", (ctx, _req, p) => getQuestion(ctx, p.id));
export const PATCH = workspaceRoute<{ org: string; id: string }>("questions.edit", (ctx, req, p) => updateQuestionHandler(ctx, req, p.id));
