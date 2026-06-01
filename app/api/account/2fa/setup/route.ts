import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { encryptString } from "@/lib/crypto";
import { createOtpAuthUrl, createTotpSecret } from "@/lib/twoFactor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, totpEnabledAt: true },
  });
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.totpEnabledAt) {
    return Response.json({ error: "Two-factor authentication is already enabled." }, { status: 409 });
  }

  const secret = createTotpSecret();
  const otpauthUrl = createOtpAuthUrl(row.email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    margin: 1,
    width: 220,
    color: {
      dark: "#1A1410",
      light: "#FAF7F2",
    },
  });

  return Response.json({
    setupToken: encryptString(secret),
    otpauthUrl,
    qrDataUrl,
  });
}
