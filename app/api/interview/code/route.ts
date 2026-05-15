import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  interview_id: z.string().min(1),
  code: z.string().max(20_000),
  language: z.enum(["python", "javascript", "java", "cpp"]).optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 }
    );
  }

  // Verify ownership and that it's still editable.
  const interview = await prisma.interview.findFirst({
    where: { id: parsed.interview_id, userId: user.id },
    select: { id: true, status: true },
  });
  if (!interview) return Response.json({ error: "Not found" }, { status: 404 });
  if (interview.status === "COMPLETED") {
    return Response.json({ error: "Read-only" }, { status: 403 });
  }

  await prisma.interview.update({
    where: { id: interview.id },
    data: {
      code: parsed.code,
      ...(parsed.language ? { language: parsed.language } : {}),
    },
  });

  return Response.json({ ok: true });
}
