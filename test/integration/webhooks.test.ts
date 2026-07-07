import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { once } from "node:events";

import { newApp, getToken, authHeader } from "../helpers.ts";
import * as store from "../../src/services/store.ts";
import * as webhooks from "../../src/services/webhooks.ts";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let token: string;

before(async () => {
  app = await newApp();
  token = await getToken(app);
  webhooks.start();
});
after(() => app.close());

test("POST /v1/webhooks requires a callbackUrl", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/v1/webhooks",
    headers: authHeader(token),
    payload: {},
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().errorCode, "MISSING_REQUIRED_FIELD");
});

test("POST /v1/webhooks rejects an invalid callbackUrl", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/v1/webhooks",
    headers: authHeader(token),
    payload: { callbackUrl: "not a url" },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().errorCode, "INVALID_CALLBACK_URL");
});

test("webhook subscribe → list → delete lifecycle", async () => {
  const sub = await app.inject({
    method: "POST",
    url: "/v1/webhooks",
    headers: authHeader(token),
    payload: {
      callbackUrl: "https://example.test/hook",
      flowTypes: ["SupplierInvoice"],
      flowDirection: "In",
    },
  });
  assert.equal(sub.statusCode, 201);
  const created = sub.json();
  assert.ok(created.webhookId);
  assert.ok(created.signingKey);

  const list = await app.inject({ method: "GET", url: "/v1/webhooks", headers: authHeader(token) });
  assert.equal(list.statusCode, 200);
  const listed = list.json();
  assert.ok(listed.webhooks.some((w: { webhookId: string }) => w.webhookId === created.webhookId));

  const del = await app.inject({
    method: "DELETE",
    url: `/v1/webhooks/${created.webhookId}`,
    headers: authHeader(token),
  });
  assert.equal(del.statusCode, 204);

  const delAgain = await app.inject({
    method: "DELETE",
    url: `/v1/webhooks/${created.webhookId}`,
    headers: authHeader(token),
  });
  assert.equal(delAgain.statusCode, 404);
});

test("a matching flow triggers a signed webhook POST to the callback", async () => {
  const received: { body: string; signature: string; timestamp: string }[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      received.push({
        body: Buffer.concat(chunks).toString("utf8"),
        signature: String(req.headers["afnor-signature"]),
        timestamp: String(req.headers["afnor-signature-timestamp"]),
      });
      res.statusCode = 200;
      res.end("ok");
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  if (addr === null || typeof addr === "string") {
    throw new Error("no server address");
  }
  const callbackUrl = `http://127.0.0.1:${addr.port}/hook`;

  try {
    const sub = await app.inject({
      method: "POST",
      url: "/v1/webhooks",
      headers: authHeader(token),
      payload: { callbackUrl, flowDirection: "In", flowTypes: ["SupplierInvoice"] },
    });
    const { signingKey } = sub.json();

    store.createFlow({
      flowType: "SupplierInvoice",
      flowDirection: "In",
      flowSyntax: "UBL",
      invoiceNumber: "HOOK-1",
    });

    for (let i = 0; i < 50 && received.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(received.length, 1, "webhook should have been delivered once");

    const { body, signature, timestamp } = received[0];
    const expected = crypto
      .createHmac("sha256", Buffer.from(signingKey, "base64"))
      .update(`${body}@${timestamp}`)
      .digest("base64");
    assert.equal(signature, expected, "HMAC signature must verify against signingKey");

    const payload = JSON.parse(body);
    assert.equal(payload.flowType, "SupplierInvoice");
    assert.equal(payload.flowDirection, "In");
  } finally {
    server.close();
  }
});

test("a non-matching flow does not trigger the webhook", async () => {
  const received: number[] = [];
  const server = http.createServer((_req, res) => {
    received.push(1);
    res.end("ok");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  if (addr === null || typeof addr === "string") {
    throw new Error("no server address");
  }
  const callbackUrl = `http://127.0.0.1:${addr.port}/hook`;

  try {
    await app.inject({
      method: "POST",
      url: "/v1/webhooks",
      headers: authHeader(token),
      payload: { callbackUrl, flowDirection: "Out" },
    });
    store.createFlow({ flowType: "SupplierInvoice", flowDirection: "In", flowSyntax: "UBL" });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(received.length, 0);
  } finally {
    server.close();
  }
});
