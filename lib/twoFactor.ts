import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verifySync } from "otplib";
import { prisma } from "@/lib/db";
import { decryptString } from "@/lib/crypto";

export const TWO_FACTOR_REQUIRED_PREFIX = "TOTP_REQUIRED:";
export const TWO_FACTOR_INVALID_PREFIX = "TOTP_INVALID:";
export const RECOVERY_CODE_COUNT = 10;

export function createTotpSecret() {
  return generateSecret();
}

export function createOtpAuthUrl(email: string, secret: string) {
  return generateURI({
    issuer: "inturview",
    label: email,
    secret,
  });
}

export function verifyTotpCode(secret: string, code: string) {
  return verifySync({
    secret,
    token: normalizeCode(code),
    epochTolerance: 30,
  }).valid;
}

export function normalizeCode(code: string) {
  return code.replace(/\s+/g, "");
}

export function normalizeRecoveryCode(code: string) {
  return code.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(9).toString("hex").toUpperCase();
    return `${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}`;
  });
}

export async function hashRecoveryCodes(codes: string[]) {
  return Promise.all(codes.map((code) => bcrypt.hash(normalizeRecoveryCode(code), 12)));
}

export function recoveryHashesFromJson(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export async function consumeRecoveryCode(userId: string, code: string, hashes: string[]) {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return false;

  for (let i = 0; i < hashes.length; i += 1) {
    if (await bcrypt.compare(normalized, hashes[i]!)) {
      const next = hashes.filter((_, idx) => idx !== i);
      await prisma.user.update({
        where: { id: userId },
        data: { totpRecoveryCodes: next },
      });
      return true;
    }
  }

  return false;
}

export async function verifySecondFactorForUser({
  userId,
  encryptedSecret,
  recoveryHashes,
  code,
}: {
  userId: string;
  encryptedSecret: string | null;
  recoveryHashes: string[];
  code: string;
}) {
  if (!encryptedSecret) return false;

  const trimmed = code.trim();
  if (!trimmed) return false;

  try {
    const secret = decryptString(encryptedSecret);
    if (/^\d[\d\s]{4,}\d$/.test(trimmed) && verifyTotpCode(secret, trimmed)) {
      return true;
    }
  } catch {
    return false;
  }

  return consumeRecoveryCode(userId, trimmed, recoveryHashes);
}
