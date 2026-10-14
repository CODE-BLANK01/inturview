import { workspaceRoute } from "@/lib/hiring/routes";
import { createQuestionHandler, listQuestions } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = workspaceRoute<{ org: string }>("questions.edit", (ctx, req) => listQuestions(ctx, req));
export const POST = workspaceRoute<{ org: string }>("questions.edit", (ctx, req) => createQuestionHandler(ctx, req));
