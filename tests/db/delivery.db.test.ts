import "./setup";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/db";
import type { BatchResult, SendEmailParams } from "../../lib/email";
import { cancelInvite, MAX_ATTEMPTS, processDeliveries, queueCampaign, queueDeliveries } from "../../lib/delivery";
import { findInviteByToken, InviteActionError, resendInvite } from "../../lib/invites";

const run = randomBytes(4).toString("hex");
let orgId = "";
let campaignId = "";

/** A fake provider that records what it was asked to send. */
function fakeSend(outcome: (m: SendEmailParams, call: number) => BatchResult | Promise<BatchResult> = () => ({ ok: true, messageId: "m" })) {
  const calls: { messages: SendEmailParams[]; key?: string }[] = [];
  const send = async (messages: SendEmailParams[], opts: { idempotencyKey?: string }) => {
    calls.push({ messages, key: opts.idempotencyKey });
    return Promise.all(messages.map((m) => outcome(m, calls.length)));
  };
  return { send, calls, links: () => calls.flatMap((c) => c.messages.map((m) => m.text.match(/\/i\/([A-Za-z0-9_-]+)/)![1]!)) };
}

async function invite(email: string) {
  return prisma.invite.create({ data: { campaignId, email: `${email}-${run}@example.test` }, select: { id: true } });
}

before(async () => {
  const org = await prisma.organization.create({ data: { name: `Co ${run}`, slug: `co-d-${run}` } });
  orgId = org.id;
  const loop = await prisma.loopTemplate.create({ data: { name: "Loop", organizationId: org.id, status: "PUBLISHED", currentVersion: 1 } });
  await prisma.loopTemplateVersion.create({
    data: { loopTemplateId: loop.id, version: 1, snapshot: { config: { name: "Loop", rounds: [{}] }, totalMinutes: 20 } },
  });
  campaignId = (await prisma.campaign.create({ data: { organizationId: org.id, loopTemplateId: loop.id, loopVersion: 1, name: "Batch" } })).id;
});

beforeEach(async () => {
  await prisma.invite.deleteMany({ where: { campaignId } });
});

after(async () => {
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe("sending", () => {
  test("two Send clicks at once queue and send each invite once, with one live link", async () => {
    const a = await invite("a");
    const b = await invite("b");
    const [q1, q2] = await Promise.all([queueCampaign(campaignId), queueCampaign(campaignId)]);
    assert.equal(q1 + q2, 2);
    const p = fakeSend();
    const [r1, r2] = await Promise.all([processDeliveries({ campaignId, send: p.send }), processDeliveries({ campaignId, send: p.send })]);
    assert.equal(r1.sent + r2.sent, 2);
    assert.equal(p.links().length, 2);
    for (const { id } of [a, b]) {
      const inv = await prisma.invite.findUniqueOrThrow({ where: { id } });
      assert.equal(inv.status, "SENT");
      assert.equal(inv.sendCount, 1);
    }
    for (const link of p.links()) assert.equal((await findInviteByToken(link)).ok, true);
  });

  test("a failed send retries with the same link, then gives up after the last attempt", async () => {
    const { id } = await invite("retry");
    await queueDeliveries([id]);
    const p = fakeSend(() => ({ ok: false, error: "rate limited" }));
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      await prisma.delivery.updateMany({ where: { inviteId: id }, data: { runAfter: new Date(0) } });
      const r = await processDeliveries({ inviteId: id, send: p.send });
      assert.deepEqual(r, i < MAX_ATTEMPTS ? { sent: 0, failed: 0, retrying: 1 } : { sent: 0, failed: 1, retrying: 0 });
    }
    assert.equal(new Set(p.links()).size, 1, "every retry carries the same link");
    const inv = await prisma.invite.findUniqueOrThrow({ where: { id } });
    assert.equal(inv.status, "FAILED");
    assert.equal(inv.lastError, "rate limited");
    // Backoff: a re-queued send waits before the next try.
    const { id: id2 } = await invite("backoff");
    await queueDeliveries([id2]);
    await processDeliveries({ inviteId: id2, send: p.send });
    assert.deepEqual(await processDeliveries({ inviteId: id2, send: p.send }), { sent: 0, failed: 0, retrying: 0 });
  });

  test("cancelling while the email is in flight wins; the link never goes live", async () => {
    const { id } = await invite("cancel");
    await queueDeliveries([id]);
    const p = fakeSend(async () => {
      await cancelInvite(id);
      return { ok: true, messageId: "m" };
    });
    const r = await processDeliveries({ inviteId: id, send: p.send });
    assert.equal(r.sent, 0);
    const inv = await prisma.invite.findUniqueOrThrow({ where: { id }, include: { deliveries: true } });
    assert.equal(inv.status, "REVOKED");
    assert.equal(inv.tokenHash, null);
    assert.equal(inv.deliveries[0]!.state, "CANCELLED");
    assert.equal((await findInviteByToken(p.links()[0]!)).ok, false);
  });

  test("a worker that stalls loses its claim; the stale finish changes nothing", async () => {
    const { id } = await invite("lease");
    await queueDeliveries([id]);
    const inner = fakeSend();
    const outer = fakeSend(async () => {
      // While this worker is stuck, its lease expires and another worker takes over.
      await prisma.delivery.updateMany({ where: { inviteId: id }, data: { claimedAt: new Date(Date.now() - 10 * 60_000) } });
      await processDeliveries({ inviteId: id, send: inner.send });
      return { ok: true, messageId: "late" };
    });
    const r = await processDeliveries({ inviteId: id, send: outer.send });
    assert.equal(r.sent, 0, "the stalled worker's finish is ignored");
    const inv = await prisma.invite.findUniqueOrThrow({ where: { id }, include: { deliveries: true } });
    assert.equal(inv.sendCount, 1);
    assert.equal(inv.deliveries.length, 1);
    assert.equal(inv.deliveries[0]!.state, "SENT");
    assert.notEqual(inv.deliveries[0]!.providerMessageId, "late");
    assert.equal(outer.links()[0], inner.links()[0], "both attempts carried the same link");
  });

  test("each chunk is sent with an idempotency key", async () => {
    const { id } = await invite("key");
    await queueDeliveries([id]);
    const p = fakeSend();
    await processDeliveries({ inviteId: id, send: p.send });
    assert.match(p.calls[0]!.key ?? "", /^[0-9a-f-]{36}:0$/);
  });
});

describe("resending", () => {
  test("a resend kills the old link, keeps an opened invite opened, and can't double up", async () => {
    const { id } = await invite("resend");
    await queueDeliveries([id]);
    const first = fakeSend();
    await processDeliveries({ inviteId: id, send: first.send });
    await prisma.invite.update({ where: { id }, data: { status: "OPENED" } });

    // A send already queued: a second resend is refused rather than queuing a competitor.
    await queueDeliveries([id]);
    await assert.rejects(resendInvite(id), InviteActionError);
    await prisma.delivery.deleteMany({ where: { inviteId: id, state: "QUEUED" } });

    const r = await resendInvite(id); // default provider: dev log fallback
    assert.equal(r.sent, true);
    const inv = await prisma.invite.findUniqueOrThrow({ where: { id } });
    assert.equal(inv.status, "OPENED");
    assert.equal(inv.sendCount, 2);
    assert.equal((await findInviteByToken(first.links()[0]!)).ok, false, "old link stops working");
  });

  test("finished and cancelled invites can't be resent", async () => {
    const { id } = await invite("done");
    await prisma.invite.update({ where: { id }, data: { status: "COMPLETED" } });
    await assert.rejects(resendInvite(id), InviteActionError);
    await cancelInvite(id);
    await assert.rejects(resendInvite(id), InviteActionError);
  });
});
