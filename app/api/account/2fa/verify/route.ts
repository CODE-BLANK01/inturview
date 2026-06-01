import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { decryptString, encryptString } from "@/lib/crypto";
import {
  generateRecoveryCodes,
  hashRecoveryCodes,
  verifyTotpCode,
} from "@/lib/twoFactor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  setupToken: z.string().min(20).max(2000),
  code: z.string().min(6).max(32),
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
    select: { totpEnabledAt: true },
  });
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.totpEnabledAt) {
    return Response.json({ error: "Two-factor authentication is already enabled." }, { status: 409 });
  }

  let secret: string;
  try {
    secret = decryptString(parsed.setupToken);
  } catch {
    return Response.json({ error: "Setup expired. Start again." }, { status: 400 });
  }

  if (!verifyTotpCode(secret, parsed.code)) {
    return Response.json({ error: "Invalid authenticator code." }, { status: 400 });
  }

  const recoveryCodes = generateRecoveryCodes();
  const recoveryHashes = await hashRecoveryCodes(recoveryCodes);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabledAt: new Date(),
      totpSecret: encryptString(secret),
      totpRecoveryCodes: recoveryHashes,
    },
  });

  return Response.json({ ok: true, recoveryCodes });
}
