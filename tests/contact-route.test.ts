import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/contact/route";

test("contact and design-partner submissions reach the shared inbox safely", async (t) => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.RESEND_FROM;
  process.env.RESEND_API_KEY = "re_test_contact_no_network";
  process.env.RESEND_FROM = "Inturview <hello@inturview.com>";
  const deliveries: Record<string, unknown>[] = [];
  let rejectDelivery = false;
  // Exercise the actual handler and email SDK, but never send a real message.
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request, init?: RequestInit) => {
      assert.equal(new URL(String(url)).pathname, "/emails");
      assert.equal(init?.method, "POST");
      deliveries.push(JSON.parse(String(init?.body)));
      return Response.json(
        rejectDelivery
          ? { name: "validation_error", message: "Sender unavailable" }
          : { id: "test-contact-message" },
        { status: rejectDelivery ? 422 : 200 },
      );
    },
  );
  let requestNumber = 0;
  const submit = (
    overrides: Record<string, unknown> = {},
    origin = "https://inturview.com",
  ) =>
    POST(
      new NextRequest("https://inturview.com/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin,
          "x-forwarded-for": `192.0.2.${++requestNumber}`,
        },
        body: JSON.stringify({
          name: "Test Person",
          email: "visitor@example.com",
          message: "I would like to discuss the product with your team.",
          topic: "support",
          ...overrides,
        }),
      }),
    );
  try {
    await t.test(
      "Contact Us delivers to hello, preserves the message, and sets Reply-To",
      async () => {
        const response = await submit({ to: "unwanted@example.com" });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
        const delivery = deliveries.at(-1)!;
        assert.equal(delivery.to, "hello@inturview.com");
        assert.equal(delivery.from, "Inturview <hello@inturview.com>");
        assert.equal(delivery.reply_to, "visitor@example.com");
        assert.equal(delivery.subject, "Inturview — contact enquiry");
        assert.match(
          String(delivery.text),
          /I would like to discuss the product with your team\./,
        );
      },
    );
    await t.test(
      "design-partner enquiries use the same inbox with a separate subject",
      async () => {
        const response = await submit({ topic: "employers" });
        assert.equal(response.status, 200);
        const delivery = deliveries.at(-1)!;
        assert.equal(delivery.to, "hello@inturview.com");
        assert.equal(delivery.reply_to, "visitor@example.com");
        assert.equal(
          delivery.subject,
          "Inturview Hire — design partner enquiry",
        );
        assert.match(String(delivery.text), /Enquiry: Design partnership/);
      },
    );
    await t.test(
      "invalid fields and foreign origins never send email",
      async () => {
        const before = deliveries.length;
        const invalid = await submit({ email: "invalid" });
        assert.equal(invalid.status, 400);
        assert.ok((await invalid.json()).fieldErrors.email);
        assert.equal(
          (await submit({}, "https://unrelated.example")).status,
          403,
        );
        assert.equal(deliveries.length, before);
      },
    );
    await t.test("honeypot submissions never reach the inbox", async () => {
      const before = deliveries.length;
      assert.equal((await submit({ website: "filled-by-bot" })).status, 200);
      assert.equal(deliveries.length, before);
    });
    await t.test(
      "missing credentials report unavailable without logging or pretending to send",
      async () => {
        const before = deliveries.length;
        delete process.env.RESEND_API_KEY;
        assert.equal((await submit()).status, 503);
        process.env.RESEND_API_KEY = "re_test_contact_no_network";
        delete process.env.RESEND_FROM;
        assert.equal((await submit()).status, 503);
        process.env.RESEND_FROM = "Inturview <hello@inturview.com>";
        assert.equal(deliveries.length, before);
      },
    );
    await t.test(
      "delivery failures return an error with the direct contact address",
      async () => {
        rejectDelivery = true;
        const response = await submit();
        assert.equal(response.status, 502);
        assert.match((await response.json()).error, /hello@inturview\.com/);
      },
    );
  } finally {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
    if (previousFrom === undefined) delete process.env.RESEND_FROM;
    else process.env.RESEND_FROM = previousFrom;
  }
});
