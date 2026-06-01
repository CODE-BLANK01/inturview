import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function encryptionKey(): Buffer {
  const material = process.env.APP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!material) {
    throw new Error("Missing APP_ENCRYPTION_KEY or NEXTAUTH_SECRET");
  }
  return deriveKey(material);
}

function deriveKey(material: string): Buffer {
  return createHash("sha256").update(material).digest();
}

function decryptionKeys(): Buffer[] {
  const materials = [
    process.env.APP_ENCRYPTION_KEY,
    process.env.NEXTAUTH_SECRET,
  ].filter((value): value is string => Boolean(value));

  const unique = [...new Set(materials)];
  if (unique.length === 0) {
    throw new Error("Missing APP_ENCRYPTION_KEY or NEXTAUTH_SECRET");
  }
  return unique.map(deriveKey);
}

export function encryptString(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString("base64url")).join(".");
}

export function decryptString(payload: string): string {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted payload");

  const iv = Buffer.from(ivRaw, "base64url");
  const tag = Buffer.from(tagRaw, "base64url");
  const encrypted = Buffer.from(encryptedRaw, "base64url");

  for (const key of decryptionKeys()) {
    try {
      const decipher = createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      // Try the next configured key. This keeps TOTP secrets decryptable when
      // APP_ENCRYPTION_KEY is added after earlier setup used NEXTAUTH_SECRET.
    }
  }

  throw new Error("Could not decrypt payload");
}
