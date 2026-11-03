import { z } from "zod";

/**
 * Reads a list of candidates from whatever people paste: Google Sheets cells
 * (tab-separated), CSV with or without a header, "Name <email>", or one email
 * per line. Pure; unit-tested.
 */

export const MAX_RECIPIENTS = 500;

export interface Recipient {
  email: string;
  name: string | null;
}

export interface ParsedRecipients {
  recipients: Recipient[];
  invalid: { line: number; text: string; reason: string }[];
  duplicates: number;
  truncated: boolean;
}

const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;
const HEADER = /^(e-?mail|email address|name|full name|first name|candidate)$/i;

/** Splits one CSV/TSV line, honouring double quotes. */
function cells(line: string): string[] {
  const sep = line.includes("\t") ? "\t" : line.includes(",") ? "," : line.includes(";") ? ";" : null;
  if (!sep) return [line.trim()];
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function fromLine(line: string): { recipient?: Recipient; reason?: string } {
  const angle = line.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (angle) {
    const email = angle[2]!.trim().toLowerCase();
    return EMAIL.test(email) ? { recipient: { email, name: angle[1]!.trim() || null } } : { reason: "Not a valid email" };
  }
  const parts = cells(line).filter(Boolean);
  const emailIndex = parts.findIndex((p) => EMAIL.test(p));
  if (emailIndex === -1) return { reason: parts.some((p) => p.includes("@")) ? "Not a valid email" : "No email found" };
  // A name is the other non-empty cells, e.g. "First" "Last" or "Full name".
  const name = parts.filter((_, i) => i !== emailIndex).filter((p) => !EMAIL.test(p)).join(" ").replace(/\s+/g, " ").trim();
  return { recipient: { email: parts[emailIndex]!.toLowerCase(), name: name || null } };
}

export function parseRecipients(text: string): ParsedRecipients {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  const invalid: ParsedRecipients["invalid"] = [];
  let duplicates = 0;
  let truncated = false;

  // A bare comma-separated list on one line: "a@x.com, b@y.com".
  const expanded: { line: number; text: string }[] = [];
  lines.forEach((raw, i) => {
    const t = raw.trim();
    if (!t) return;
    const bits = t.split(/[,;]/).map((b) => b.trim()).filter(Boolean);
    if (bits.length > 1 && bits.every((b) => EMAIL.test(b) || /<[^>]+@[^>]+>/.test(b))) {
      for (const b of bits) expanded.push({ line: i + 1, text: b });
    } else expanded.push({ line: i + 1, text: t });
  });

  expanded.forEach(({ line, text: t }, idx) => {
    // Skip a header row like "Name, Email" at the top.
    if (idx === 0 && cells(t).every((c) => !c || HEADER.test(c))) return;
    const { recipient, reason } = fromLine(t);
    if (!recipient) {
      invalid.push({ line, text: t.slice(0, 120), reason: reason! });
      return;
    }
    if (seen.has(recipient.email)) {
      duplicates++;
      return;
    }
    if (recipients.length >= MAX_RECIPIENTS) {
      truncated = true;
      return;
    }
    seen.add(recipient.email);
    recipients.push(recipient);
  });
  return { recipients, invalid, duplicates, truncated };
}

/** Server-side check of a parsed list before anything is stored. */
export const RecipientsSchema = z
  .array(z.object({ email: z.string().trim().toLowerCase().email(), name: z.string().trim().max(120).nullable().default(null) }))
  .min(1, "Add at least one candidate.")
  .max(MAX_RECIPIENTS, `At most ${MAX_RECIPIENTS} candidates at a time.`);
