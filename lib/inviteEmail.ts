// The candidate invitation email. Pure and client-safe, so the invite form can
// show exactly what will be sent.
import type { SendEmailParams } from "./email";

export const DEFAULT_LINK_DAYS = 14;

export function inviteExpiry(sentAt: Date, deadline: Date | null): Date {
  const byDays = new Date(sentAt.getTime() + DEFAULT_LINK_DAYS * 86_400_000);
  return deadline && deadline < byDays ? deadline : byDays;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface InviteEmailInput {
  to: string;
  name: string | null;
  loopName: string;
  rounds: number;
  minutes: number;
  message: string | null;
  link: string;
  expiresAt: Date;
  /** The hiring company; null for the old platform test campaigns. */
  company?: string | null;
  /** Where candidate replies go: the company's contact address when set. */
  replyTo?: string | null;
}

/** The invitation email. Pure; unit-tested. */
export function inviteEmail(i: InviteEmailInput): SendEmailParams {
  // Sent on the company's behalf, so it signs as them.
  const signOff = i.company ? `— The ${i.company} hiring team, via inturview` : "— inturview";
  const first = i.name?.split(/\s+/)[0] ?? null;
  const when = i.expiresAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const length = `${i.rounds} round${i.rounds === 1 ? "" : "s"}, about ${i.minutes} minutes`;
  const text = [
    `Hi${first ? ` ${first}` : ""},`,
    "",
    `${i.company ? `${i.company} invited you` : "You're invited"} to an interview: ${i.loopName} (${length}).`,
    ...(i.message ? ["", i.message] : []),
    "",
    "It runs in your browser with an AI interviewer. You can start whenever suits you before the link expires.",
    "",
    i.link,
    "",
    `The link is personal to you and works until ${when}.`,
    "Need an adjustment, like more time or a different format? Reply to this email.",
    "",
    signOff,
  ].join("\n");
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FAF7F2;color:#1A1410;padding:32px;line-height:1.6">
  <p>Hi${first ? ` ${esc(first)}` : ""},</p>
  <p>${i.company ? `${esc(i.company)} invited you` : "You're invited"} to an interview: <strong>${esc(i.loopName)}</strong> (${esc(length)}).</p>
  ${i.message ? `<p style="border-left:3px solid #E8E2D9;padding-left:12px;color:#4A3F37">${esc(i.message).replace(/\n/g, "<br>")}</p>` : ""}
  <p>It runs in your browser with an AI interviewer. You can start whenever suits you before the link expires.</p>
  <p style="margin:24px 0"><a href="${esc(i.link)}" style="background:#1A1410;color:#FAF7F2;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">Open your interview</a></p>
  <p style="font-size:13px;color:#6B5E54">The link is personal to you and works until ${esc(when)}.<br>Need an adjustment, like more time or a different format? Reply to this email.</p>
  <p style="font-size:13px;color:#6B5E54">${esc(signOff)}</p>
</body></html>`;
  return {
    to: i.to,
    subject: i.company ? `${i.company}: ${i.loopName} interview` : `You're invited: ${i.loopName}`,
    text,
    html,
    replyTo: i.replyTo || "hello@inturview.com",
  };
}

