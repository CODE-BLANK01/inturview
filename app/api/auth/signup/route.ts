import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { adminEmails } from "@/lib/auth";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";
import {
  createVerificationToken,
  sendVerificationEmail,
} from "@/lib/emailVerification";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email().max(200),
  name: z.string().trim().min(1).max(80).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

export async function POST(req: NextRequest) {
  pruneExpired();
  const key = clientKey(req.headers);
  const limit = Number(process.env.RL_SIGNUP_PER_HOUR ?? 10);
  const rl = checkRateLimit({ key: `signup:${key}`, limit, windowMs: 60 * 60_000 });
  if (!rl.ok) {
    return Response.json(
      { error: "Too many signup attempts. Try again later." },
      { status: 429 }
    );
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 }
    );
  }

  const email = parsed.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(parsed.password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: parsed.name?.trim() || null,
        passwordHash,
        role: adminEmails().has(email) ? Role.ADMIN : Role.USER,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    // Fire verification email — don't block the response if Resend hiccups.
    // The user can hit "Resend verification" from /verify-email if needed.
    try {
      const { rawToken } = await createVerificationToken(user.id);
      await sendVerificationEmail({
        toEmail: user.email,
        toName: user.name,
        rawToken,
      });
    } catch (err) {
      console.error("[signup] verification email failed:", err instanceof Error ? err.message : err);
    }

    return Response.json({ user }, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return Response.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }
    return Response.json(
      { error: "Could not create account. Try again." },
      { status: 500 }
    );
  }
}
