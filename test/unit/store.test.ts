import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import * as store from "../../src/services/store.ts";
import { config } from "../../src/config.ts";
import type { CreateFlowParams, Flow } from "../../src/types.ts";

function makeFlow(overrides: Partial<CreateFlowParams> = {}): Flow {
  return store.createFlow({
    flowType: "SupplierInvoice",
    flowDirection: "In",
    flowSyntax: "UBL",
    ...overrides,
  });
}

beforeEach(() => store.resetStore());

test("createFlow assigns id/timestamps and derives defaults", () => {
  const flow = makeFlow({ invoiceNumber: "INV-1" });
  assert.match(flow.flowId, /^[0-9a-f-]{36}$/);
  assert.equal(flow.name, "flow.xml");
  assert.equal(flow.flowProfile, "CIUS");
  assert.equal(flow.processingRule, "B2B");
  assert.deepEqual(flow.acknowledgement, { status: "Ok" });
  assert.equal(flow.submittedAt, flow.updatedAt);
  assert.equal(store.count(), 1);
  assert.equal(store.getFlow(flow.flowId)?.invoiceNumber, "INV-1");
});

test("createFlow derives Undefined profile for CDAR/FRR/Unknown syntaxes", () => {
  assert.equal(makeFlow({ flowSyntax: "CDAR" }).flowProfile, "Undefined");
  assert.equal(makeFlow({ flowSyntax: "FRR" }).flowProfile, "Undefined");
  assert.equal(makeFlow({ flowSyntax: "Unknown" }).flowProfile, "Undefined");
});

test("createFlow computes sha256 from the Original document when not provided", () => {
  const content = Buffer.from("hello world", "utf8");
  const flow = makeFlow({
    documents: { Original: { content, contentType: "text/plain", filename: "a.txt" } },
  });
  assert.equal(flow.sha256, "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  assert.equal(flow.name, "a.txt");
});

test("getFlow returns null for unknown id", () => {
  assert.equal(store.getFlow("nope"), null);
});

test("updateFlowStatus mutates status, ack and updatedAt; emits", () => {
  const flow = makeFlow();
  let emitted: Flow | null = null;
  store.subscribe((f) => {
    emitted = f;
  });
  const updated = store.updateFlowStatus(flow.flowId, {
    statusCode: "206",
    statusName: "Approuvée",
    ackStatus: "Error",
  });
  assert.ok(updated);
  assert.equal(updated!.statusCode, "206");
  assert.equal(updated!.statusName, "Approuvée");
  assert.equal(updated!.acknowledgement.status, "Error");
  assert.equal(emitted!.flowId, flow.flowId);
});

test("updateFlowStatus returns null for unknown flow", () => {
  assert.equal(store.updateFlowStatus("nope", { statusCode: "1" }), null);
});

test("toFullFlowInfo omits null optional fields", () => {
  const flow = makeFlow({ trackingId: "TR-1", sha256: "abc" });
  const info = store.toFullFlowInfo(flow);
  assert.equal(info.trackingId, "TR-1");
  assert.equal(info.sha256, "abc");
  const bare = store.toFullFlowInfo(makeFlow());
  assert.ok(!("trackingId" in bare));
});

test("toSummary exposes availableDocTypes and mirrored dates", () => {
  const flow = makeFlow({
    documents: {
      Original: { content: Buffer.from("x"), contentType: "application/xml", filename: "o.xml" },
    },
  });
  const s = store.toSummary(flow);
  assert.deepEqual(s.availableDocTypes, ["Original"]);
  assert.equal(s.createdDate, flow.submittedAt);
  assert.equal(s.updatedDate, flow.updatedAt);
});

test("searchSpec filters by flowType, flowDirection and trackingId", () => {
  makeFlow({ flowType: "SupplierInvoice", flowDirection: "In", trackingId: "A" });
  makeFlow({ flowType: "CustomerInvoice", flowDirection: "Out", trackingId: "B" });

  const byType = store.searchSpec({ where: { flowType: ["SupplierInvoice"] } });
  assert.equal(byType.results.length, 1);
  assert.equal(byType.results[0].flowType, "SupplierInvoice");

  const byDir = store.searchSpec({ where: { flowDirection: ["Out"] } });
  assert.equal(byDir.results.length, 1);

  const byTracking = store.searchSpec({ where: { trackingId: "B" } });
  assert.equal(byTracking.results.length, 1);
  assert.equal(byTracking.results[0].trackingId, "B");
});

test("searchSpec paginates with an opaque cursor and stops when exhausted", () => {
  for (let i = 0; i < 5; i++) {
    makeFlow({ trackingId: `T${i}` });
  }

  const first = store.searchSpec({ where: { flowDirection: ["In"] }, limit: 2 });
  assert.equal(first.results.length, 2);
  assert.ok(first.nextCursor);

  const second = store.searchSpec({
    where: { flowDirection: ["In"] },
    limit: 2,
    cursor: first.nextCursor,
  });
  assert.equal(second.results.length, 2);
  assert.ok(second.nextCursor);

  const third = store.searchSpec({
    where: { flowDirection: ["In"] },
    limit: 2,
    cursor: second.nextCursor,
  });
  assert.equal(third.results.length, 1);
  assert.equal(third.nextCursor, undefined);

  const ids = new Set([...first.results, ...second.results, ...third.results].map((f) => f.flowId));
  assert.equal(ids.size, 5);
});

test("searchSpec clamps the limit between 1 and 100", () => {
  makeFlow();
  assert.equal(store.searchSpec({ where: { flowDirection: ["In"] }, limit: 0 }).limit, 25);
  assert.equal(store.searchSpec({ where: { flowDirection: ["In"] }, limit: 9999 }).limit, 100);
});

test("searchSpec updatedAfter is a strict comparison", async () => {
  const flow = makeFlow();
  assert.equal(store.searchSpec({ where: { updatedAfter: flow.updatedAt } }).results.length, 0);
  const before = new Date(Date.parse(flow.updatedAt) - 1000).toISOString();
  assert.equal(store.searchSpec({ where: { updatedAfter: before } }).results.length, 1);
});

test("searchInternal supports scalar or array criteria, offset and limit", () => {
  makeFlow({ flowType: "SupplierInvoice", invoiceNumber: "INV-A" });
  makeFlow({ flowType: "CustomerInvoice", invoiceNumber: "INV-B" });
  makeFlow({ flowType: "CustomerInvoice", invoiceNumber: "INV-C" });

  const scalar = store.searchInternal({ flowType: "SupplierInvoice" });
  assert.equal(scalar.total, 1);

  const arr = store.searchInternal({ flowType: ["CustomerInvoice"] });
  assert.equal(arr.total, 2);

  const byInvoice = store.searchInternal({ invoiceNumber: "INV-C" });
  assert.equal(byInvoice.flows[0].invoiceNumber, "INV-C");

  const paged = store.searchInternal({ limit: 1, offset: 1 });
  assert.equal(paged.total, 3);
  assert.equal(paged.limit, 1);
  assert.equal(paged.offset, 1);
  assert.equal(paged.flows.length, 1);
});

test("resetStore clears everything", () => {
  makeFlow();
  makeFlow();
  assert.equal(store.count(), 2);
  store.resetStore();
  assert.equal(store.count(), 0);
});

test(
  "evictIfNeeded caps stored flows at MAX_FLOWS",
  { skip: config.store.maxFlows < 1 || config.store.maxFlows > 2000 },
  () => {
    const max = config.store.maxFlows;
    for (let i = 0; i < max + 5; i++) {
      makeFlow();
    }
    assert.equal(store.count(), max);
  },
);
