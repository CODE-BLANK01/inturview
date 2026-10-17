import { adminRoute } from "@/lib/hiring/routes";
import { createQuestionHandler, listQuestions } from "@/lib/hiring/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute((ctx, req) => listQuestions(ctx, req));
export const POST = adminRoute((ctx, req) => createQuestionHandler(ctx, req));
