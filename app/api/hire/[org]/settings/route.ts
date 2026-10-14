import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { workspaceApi } from "@/lib/workspaceGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .transform((s) => s || null)
  .refine((s) => !s || /^https:\/\/[^\s]+$/i.test(s), "Use a full https:// address.")
  .nullable();

const Patch = z.object({
  name: z.string().trim().min(2, "Name the company.").max(120),
  timezone: z.string().trim().refine((tz) => tz === "UTC" || Intl.supportedValuesOf("timeZone").includes(tz), "Unknown timezone"),
  website: optionalUrl,
  logoUrl: optionalUrl,
  contactEmail: z
    .string()
    .trim()
    .max(200)
    .transform((s) => s.toLowerCase() || null)
    .refine((s) => !s || z.string().email().safeParse(s).success, "Enter a valid contact email.")
    .nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { org: string } }) {
  const guard = await workspaceApi(params.org, "workspace.editProfile");
  if (!guard.ok) return guard.response;
  const { access, user } = guard;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
  await prisma.organization.update({ where: { id: access.org.id }, data: parsed.data });
  await writeAudit({ adminId: user.id, action: "ORG_UPDATED", targetType: "organization", targetId: access.org.id, metadata: { fields: Object.keys(parsed.data) } });
  return Response.json({ ok: true });
}
