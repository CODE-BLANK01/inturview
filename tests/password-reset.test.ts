import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "../lib/db";
import { POST as requestReset } from "../app/api/auth/forgot-password/route";
import { POST as resetPassword } from "../app/api/auth/reset-password/route";
import { appUrl, sendEmail } from "../lib/email";

test("password reset delivery and recovery flow", async (t) => {
  const envNames = [
    "RESEND_API_KEY",
    "RESEND_FROM",
    "NEXTAUTH_URL",
    "NODE_ENV",
    "RL_FORGOT_PASSWORD_PER_HOUR",
    "RL_FORGOT_TARGET_PER_HOUR",
  ] as const;
  const previous = Object.fromEntries(
    envNames.map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    RESEND_API_KEY: "re_test_no_real_delivery",
    RESEND_FROM: "Inturview <hello@inturview.com>",
    NEXTAUTH_URL: "https://inturview.com/",
    NODE_ENV: "test",
    RL_FORGOT_PASSWORD_PER_HOUR: "100",
    RL_FORGOT_TARGET_PER_HOUR: "100",
  });
  const user = {
    id: "test-reset-user",
    email: "reset-flow@example.com",
    name: "<Example>",
    disabledAt: null as Date | null,
    passwordHash: "old-password-hash",
    tokenVersion: 2,
  };
  type Token = {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
  };
  const tokens: Token[] = [];
  const messages: Record<string, string>[] = [];
  let lookupFailure = false;
  let deliveryFailure = false;
  let lookups = 0;
  // All database operations and provider requests are mocked. No account is changed.
  t.mock.method(
    prisma.user,
    "findUnique",
    async ({ where }: { where: { email?: string; id?: string } }) => {
      lookups++;
      if (lookupFailure) throw new Error("Database unavailable");
      return where.email === user.email || where.id === user.id
        ? { ...user }
        : null;
    },
  );
  t.mock.method(
    prisma.user,
    "update",
    async ({
      data,
    }: {
      data: { passwordHash: string; tokenVersion: { increment: number } };
    }) => {
      user.passwordHash = data.passwordHash;
      user.tokenVersion += data.tokenVersion.increment;
      return { ...user };
    },
  );
  t.mock.method(
    prisma.passwordResetToken,
    "create",
    async ({ data }: { data: Omit<Token, "id" | "usedAt"> }) => {
      const row = { ...data, id: `token-${tokens.length}`, usedAt: null };
      tokens.push(row);
      return row;
    },
  );
  t.mock.method(
    prisma.passwordResetToken,
    "updateMany",
    async ({
      where,
      data,
    }: {
      where: { userId: string; usedAt: null };
      data: { usedAt: Date };
    }) => {
      let count = 0;
      for (const row of tokens)
        if (row.userId === where.userId && row.usedAt === null) {
          row.usedAt = data.usedAt;
          count++;
        }
      return { count };
    },
  );
  t.mock.method(
    prisma.passwordResetToken,
    "findUnique",
    async ({ where }: { where: { tokenHash: string } }) =>
      tokens.find((row) => row.tokenHash === where.tokenHash) ?? null,
  );
  t.mock.method(
    prisma.passwordResetToken,
    "update",
    async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { usedAt: Date };
    }) => {
      const row = tokens.find((row) => row.id === where.id)!;
      row.usedAt = data.usedAt;
      return row;
    },
  );
  t.mock.method(
    prisma,
    "$transaction",
    async (operations: Promise<unknown>[]) => Promise.all(operations),
  );
  const errorLog = t.mock.method(console, "error", () => {});
  const infoLog = t.mock.method(console, "info", () => {});
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.hostname === "api.pwnedpasswords.com") return new Response("");
      assert.equal(url.origin, "https://api.resend.com");
      assert.equal(url.pathname, "/emails");
      assert.equal(init?.method, "POST");
      messages.push(JSON.parse(String(init?.body)));
      return Response.json(
        deliveryFailure
          ? {
              name: "validation_error",
              message: "Sender domain is not verified",
            }
          : { id: "mock-provider-message" },
        { status: deliveryFailure ? 422 : 200 },
      );
    },
  );
  let requestNumber = 0;
  const request = (email = user.email, ip?: string) =>
    requestReset(
      new NextRequest("https://inturview.com/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": ip ?? `192.0.2.${++requestNumber}`,
        },
        body: JSON.stringify({ email }),
      }),
    );
  const change = (token: string, password = "UniqueTestPassword!2026") =>
    resetPassword(
      new NextRequest("https://inturview.com/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `198.51.100.${++requestNumber}`,
        },
        body: JSON.stringify({ token, password }),
      }),
    );
  const latestLink = () =>
    new URL(messages.at(-1)!.text.match(/https:\/\/[^\s]+/)![0]);
  try {
    await t.test(
      "normalizes the address, generates a hashed token, and sends a working HTTPS link",
      async () => {
        const response = await request(" RESET-FLOW@EXAMPLE.COM ");
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
        const message = messages.at(-1)!;
        assert.equal(message.to, user.email);
        assert.match(message.html, /Hi &lt;Example&gt;/);
        const link = latestLink();
        assert.equal(link.origin, "https://inturview.com");
        assert.equal(link.pathname, "/reset-password");
        const raw = link.searchParams.get("token")!;
        assert.equal(raw.length, 43);
        assert.equal(
          tokens.at(-1)!.tokenHash,
          createHash("sha256").update(raw).digest("hex"),
        );
        assert.equal(JSON.stringify(tokens).includes(raw), false);
        assert.equal(JSON.stringify(infoLog.mock.calls).includes(raw), false);
        assert.ok(
          tokens.at(-1)!.expiresAt.getTime() > Date.now() + 59 * 60_000,
        );
      },
    );
    await t.test(
      "an accepted reset updates the password, revokes sessions, and cannot be reused",
      async () => {
        const token = latestLink().searchParams.get("token")!;
        assert.equal((await change(token)).status, 200);
        assert.equal(
          await bcrypt.compare("UniqueTestPassword!2026", user.passwordHash),
          true,
        );
        assert.equal(user.tokenVersion, 3);
        const replay = await change(token);
        assert.equal(replay.status, 400);
        assert.match((await replay.json()).error, /already been used/);
      },
    );
    await t.test(
      "expired and unknown links cannot change a password",
      async () => {
        await request();
        const token = latestLink().searchParams.get("token")!;
        tokens.at(-1)!.expiresAt = new Date(Date.now() - 1);
        const expired = await change(token);
        assert.equal(expired.status, 400);
        assert.match((await expired.json()).error, /expired/);
        assert.equal(
          (await change("unknown-token-that-is-long-enough")).status,
          400,
        );
        assert.equal(user.tokenVersion, 3);
      },
    );
    await t.test(
      "provider rejection is logged without exposing account existence or raw tokens",
      async () => {
        deliveryFailure = true;
        const failure = await request();
        assert.equal(failure.status, 200);
        assert.deepEqual(await failure.json(), { ok: true });
        assert.match(
          JSON.stringify(errorLog.mock.calls),
          /Sender domain is not verified/,
        );
        assert.equal(
          JSON.stringify(errorLog.mock.calls).includes(
            latestLink().searchParams.get("token")!,
          ),
          false,
        );
        const before = messages.length;
        const absent = await request("absent@example.com");
        assert.deepEqual(await absent.json(), { ok: true });
        user.disabledAt = new Date();
        const disabled = await request();
        assert.deepEqual(await disabled.json(), { ok: true });
        user.disabledAt = null;
        assert.equal(messages.length, before);
        deliveryFailure = false;
      },
    );
    await t.test(
      "missing mail setup and invalid production URL fail before account lookup",
      async () => {
        const before = lookups;
        delete process.env.RESEND_API_KEY;
        assert.equal((await request()).status, 503);
        assert.equal((await request("absent@example.com")).status, 503);
        process.env.RESEND_API_KEY = "re_test_no_real_delivery";
        delete process.env.RESEND_FROM;
        assert.equal((await request()).status, 503);
        process.env.RESEND_FROM = "Inturview <hello@inturview.com>";
        Object.assign(process.env, {
          NODE_ENV: "production",
          NEXTAUTH_URL: "http://localhost:3000",
        });
        assert.equal((await request()).status, 503);
        assert.equal(lookups, before);
        delete process.env.RESEND_API_KEY;
        const logged = t.mock.method(console, "log", () => {});
        assert.equal(
          (
            await sendEmail({
              to: user.email,
              subject: "Reset",
              text: "secret-reset-link",
            })
          ).ok,
          false,
        );
        assert.equal(logged.mock.callCount(), 0);
        logged.mock.restore();
        Object.assign(process.env, {
          NODE_ENV: "test",
          NEXTAUTH_URL: "https://inturview.com",
          RESEND_API_KEY: "re_test_no_real_delivery",
        });
        assert.equal(appUrl(), "https://inturview.com");
      },
    );
    await t.test(
      "database failure returns a retryable service error",
      async () => {
        lookupFailure = true;
        assert.equal((await request()).status, 503);
        lookupFailure = false;
      },
    );
    await t.test(
      "invalid input and exhausted limits report actionable errors",
      async () => {
        assert.equal((await request("not an email")).status, 400);
        process.env.RL_FORGOT_PASSWORD_PER_HOUR = "2";
        await request("ip-a@example.com", "203.0.113.99");
        await request("ip-b@example.com", "203.0.113.99");
        const ipLimit = await request("ip-c@example.com", "203.0.113.99");
        assert.equal(ipLimit.status, 429);
        assert.ok(Number(ipLimit.headers.get("retry-after")) > 0);
        process.env.RL_FORGOT_TARGET_PER_HOUR = "2";
        await request("limited-target@example.com");
        await request("limited-target@example.com");
        assert.equal((await request("limited-target@example.com")).status, 429);
      },
    );
  } finally {
    for (const key of envNames) {
      if (previous[key] === undefined) delete process.env[key];
      else (process.env as Record<string, string | undefined>)[key] = previous[key];
    }
  }
});
