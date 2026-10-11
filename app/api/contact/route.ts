import type { NextRequest } from "next/server";
import { CONTACT_EMAIL, CONTACT_SUBJECTS, ContactSchema } from "@/lib/contact";
import { sendEmail } from "@/lib/email";
import { captureProductEvent } from "@/lib/analytics";
import { requireUser } from "@/lib/auth";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin)
    return Response.json(
      { error: "Please send this form from Inturview." },
      { status: 403 },
    );
  pruneExpired();
  const rate = checkRateLimit({
    key: `contact:${clientKey(req.headers)}`,
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!rate.ok)
    return Response.json(
      {
        error: `Too many messages. Please try again later, or email ${CONTACT_EMAIL}.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rate.resetMs / 1000)) },
      },
    );
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 20_000)
      return Response.json(
        { error: "Your message is too long." },
        { status: 413 },
      );
    body = JSON.parse(raw);
  } catch {
    return Response.json(
      { error: "We could not read that message. Please try again." },
      { status: 400 },
    );
  }
  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success)
    return Response.json(
      { fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  if (parsed.data.website) return Response.json({ ok: true });
  // Never report a message as delivered through the email helper's dev logging fallback.
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM)
    return Response.json(
      {
        error: `The form is temporarily unavailable. Please email ${CONTACT_EMAIL}; your message is still here.`,
      },
      { status: 503 },
    );
  const { name, email, message, topic } = parsed.data;
  const result = await sendEmail({
    to: CONTACT_EMAIL,
    replyTo: email,
    subject: CONTACT_SUBJECTS[topic],
    text: `Enquiry: ${topic === "employers" ? "Design partnership" : "Contact us"}\nFrom: ${name || "Not supplied"}\nReply to: ${email}\n\n${message}`,
  });
  if (!result.ok)
    return Response.json(
      {
        error: `Your message could not be delivered. Please try again, or email ${CONTACT_EMAIL}.`,
      },
      { status: 502 },
    );
  const sender = await requireUser().catch(() => null);
  await captureProductEvent(sender?.id ?? `anon_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`, {
    event: "contact_submitted",
    properties: { topic },
  });
  return Response.json({ ok: true });
}
