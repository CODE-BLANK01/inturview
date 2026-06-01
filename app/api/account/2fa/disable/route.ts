import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  recoveryHashesFromJson,
  verifySecondFactorForUser,
} from "@/lib/twoFactor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  password: z.string().min(1).max(128),
  code: z.string().min(1).max(64),
});

export async function POST(req: Request) {
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

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      passwordHash: true,
      disabledAt: true,
      totpEnabledAt: true,
      totpSecret: true,
      totpRecoveryCodes: true,
    },
  });
  if (!row || row.disabledAt) {
    return Response.json({ error: "Account not available." }, { status: 404 });
  }
  if (!row.totpEnabledAt) {
    return Response.json({ error: "Two-factor authentication is not enabled." }, { status: 409 });
  }

  const passwordOk = await bcrypt.compare(parsed.password, row.passwordHash);
  if (!passwordOk) {
    return Response.json({ error: "Password is incorrect." }, { status: 400 });
  }

  const secondFactorOk = await verifySecondFactorForUser({
    userId: user.id,
    encryptedSecret: row.totpSecret,
    recoveryHashes: recoveryHashesFromJson(row.totpRecoveryCodes),
    code: parsed.code,
  });
  if (!secondFactorOk) {
    return Response.json({ error: "Invalid two-factor code." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabledAt: null,
      totpSecret: null,
      totpRecoveryCodes: [],
      tokenVersion: { increment: 1 },
    },
  });

  return Response.json({ ok: true, mustSignInAgain: true });
}
