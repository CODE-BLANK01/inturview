import { adminRoute } from "@/lib/hiring/routes";
import { getQuestion, updateQuestionHandler } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute<{ id: string }>((ctx, _req, p) => getQuestion(ctx, p.id));
export const PATCH = adminRoute<{ id: string }>((ctx, req, p) => updateQuestionHandler(ctx, req, p.id));
