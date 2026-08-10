import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { newApp, getToken, authHeader, multipart, UBL_XML, SAMPLE_UBL } from "../helpers.ts";
import * as store from "../../src/services/store.ts";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let token: string;

before(async () => {
  app = await newApp();
  token = await getToken(app);
});
after(() => app.close());
beforeEach(() => store.resetStore());

async function deposit(fileContent: string, flowInfo: Record<string, unknown>) {
  const { payload, contentType } = multipart([
    { name: "file", filename: "invoice.xml", contentType: "application/xml", content: fileContent },
    { name: "flowInfo", contentType: "application/json", value: JSON.stringify(flowInfo) },
  ]);
  return app.inject({
    method: "POST",
    url: "/v1/flows",
    headers: { ...authHeader(token), "content-type": contentType },
    payload,
  });
}

test("POST /v1/flows deposits a flow and returns 202 FullFlowInfo", async () => {
  const res = await deposit(UBL_XML, {
    name: "invoice.xml",
    flowSyntax: "UBL",
    trackingId: "REF-001",
  });
  assert.equal(res.statusCode, 202);
  const body = res.json();
  assert.ok(body.flowId);
  assert.equal(body.name, "invoice.xml");
  assert.equal(body.flowSyntax, "UBL");
  assert.equal(body.trackingId, "REF-001");
  assert.equal(body.sha256, crypto.createHash("sha256").update(Buffer.from(UBL_XML)).digest("hex"));

  const stored = store.getFlow(body.flowId);
  assert.equal(stored?.flowDirection, "Out");
  assert.equal(stored?.invoiceNumber, "INV-UBL-001");
});

test("POST /v1/flows auto-detects the syntax when flowInfo omits it", async () => {
  const res = await deposit(UBL_XML, { name: "invoice.xml" });
  assert.equal(res.statusCode, 202);
  assert.equal(res.json().flowSyntax, "UBL");
});

test("POST /v1/flows generates the readable PDF and converted CII for an invoice upload", async () => {
  const res = await deposit(SAMPLE_UBL, { name: "invoice.xml", flowSyntax: "UBL" });
  assert.equal(res.statusCode, 202);
  const { flowId } = res.json();

  const stored = store.getFlow(flowId);
  assert.deepEqual(Object.keys(stored!.documents).sort(), [
    "Converted",
    "Original",
    "ReadableView",
  ]);

  const pdf = await app.inject({
    method: "GET",
    url: `/v1/flows/${flowId}?docType=ReadableView`,
    headers: authHeader(token),
  });
  assert.equal(pdf.statusCode, 200);
  assert.equal(pdf.headers["content-type"], "application/pdf");

  const converted = await app.inject({
    method: "GET",
    url: `/v1/flows/${flowId}?docType=Converted`,
    headers: authHeader(token),
  });
  assert.equal(converted.statusCode, 200);
  assert.match(converted.payload, /CrossIndustryInvoice/);
});

test("POST /v1/flows rejects a checksum mismatch", async () => {
  const res = await deposit(UBL_XML, {
    name: "invoice.xml",
    flowSyntax: "UBL",
    sha256: "deadbeef",
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().errorCode, "CHECKSUM_MISMATCH");
});

test("POST /v1/flows accepts a matching checksum", async () => {
  const good = crypto.createHash("sha256").update(Buffer.from(UBL_XML)).digest("hex");
  const res = await deposit(UBL_XML, { name: "invoice.xml", flowSyntax: "UBL", sha256: good });
  assert.equal(res.statusCode, 202);
});

test("POST /v1/flows rejects a request with no file", async () => {
  const { payload, contentType } = multipart([
    { name: "flowInfo", contentType: "application/json", value: '{"name":"x","flowSyntax":"UBL"}' },
  ]);
  const res = await app.inject({
    method: "POST",
    url: "/v1/flows",
    headers: { ...authHeader(token), "content-type": contentType },
    payload,
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().errorCode, "MISSING_REQUIRED_FIELD");
});

test("POST /v1/flows rejects invalid flowInfo JSON", async () => {
  const { payload, contentType } = multipart([
    { name: "file", filename: "a.xml", contentType: "application/xml", content: UBL_XML },
    { name: "flowInfo", value: "not-json{" },
  ]);
  const res = await app.inject({
    method: "POST",
    url: "/v1/flows",
    headers: { ...authHeader(token), "content-type": contentType },
    payload,
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().errorCode, "INVALID_FLOW_INFO");
});

test("POST /v1/flows/search requires at least one where criterion", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/v1/flows/search",
    headers: authHeader(token),
    payload: { where: {} },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().errorCode, "MISSING_REQUIRED_FIELD");
});

test("POST /v1/flows/search filters and paginates by cursor", async () => {
  for (let i = 0; i < 3; i++) {
    await deposit(UBL_XML, { name: `f${i}.xml`, flowSyntax: "UBL", trackingId: `T${i}` });
  }
  const first = await app.inject({
    method: "POST",
    url: "/v1/flows/search",
    headers: authHeader(token),
    payload: { where: { flowDirection: ["Out"] }, limit: 2 },
  });
  assert.equal(first.statusCode, 200);
  const p1 = first.json();
  assert.equal(p1.results.length, 2);
  assert.equal(p1.limit, 2);
  assert.ok(p1.nextCursor);

  const second = await app.inject({
    method: "POST",
    url: "/v1/flows/search",
    headers: authHeader(token),
    payload: { where: { flowDirection: ["Out"] }, limit: 2, cursor: p1.nextCursor },
  });
  const p2 = second.json();
  assert.equal(p2.results.length, 1);
  assert.equal(p2.nextCursor, undefined);
});

test("GET /v1/flows/:id returns Metadata JSON by default", async () => {
  const dep = await deposit(UBL_XML, { name: "invoice.xml", flowSyntax: "UBL" });
  const flowId = dep.json().flowId;
  const res = await app.inject({
    method: "GET",
    url: `/v1/flows/${flowId}`,
    headers: authHeader(token),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.flowId, flowId);
  assert.equal(body.flowSyntax, "UBL");
});

test("GET /v1/flows/:id?docType=Original downloads the raw document", async () => {
  const dep = await deposit(UBL_XML, { name: "invoice.xml", flowSyntax: "UBL" });
  const flowId = dep.json().flowId;
  const res = await app.inject({
    method: "GET",
    url: `/v1/flows/${flowId}?docType=Original`,
    headers: authHeader(token),
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["x-flow-id"], flowId);
  assert.match(String(res.headers["content-disposition"]), /attachment/);
  assert.equal(res.body, UBL_XML);
});

test("GET /v1/flows/:id rejects an invalid docType", async () => {
  const dep = await deposit(UBL_XML, { name: "invoice.xml", flowSyntax: "UBL" });
  const flowId = dep.json().flowId;
  const res = await app.inject({
    method: "GET",
    url: `/v1/flows/${flowId}?docType=Bogus`,
    headers: authHeader(token),
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().errorCode, "INVALID_DOCTYPE");
});

test("GET /v1/flows/:id 404s for an unknown flow", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/v1/flows/does-not-exist",
    headers: authHeader(token),
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().errorCode, "MISSING_RESOURCE");
});

test("GET /v1/flows/:id 404s for an unavailable component", async () => {
  const dep = await deposit(UBL_XML, { name: "invoice.xml", flowSyntax: "UBL" });
  const flowId = dep.json().flowId;
  const res = await app.inject({
    method: "GET",
    url: `/v1/flows/${flowId}?docType=Converted`,
    headers: authHeader(token),
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().errorCode, "MISSING_RESOURCE");
});
