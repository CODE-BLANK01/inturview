import { workspaceRoute } from "@/lib/hiring/routes";
import { deleteApplicantHandler, exportApplicantHandler } from "@/lib/hiring/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: export everything about the applicant. POST {confirm: "DELETE"}: delete it now. */
export const GET = workspaceRoute<{ org: string; id: string }>("applicantData.exportOrDelete", (ctx, _req, p) => exportApplicantHandler(ctx, p.id));
export const POST = workspaceRoute<{ org: string; id: string }>("applicantData.exportOrDelete", (ctx, req, p) => deleteApplicantHandler(ctx, req, p.id));
