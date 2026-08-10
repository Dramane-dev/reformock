import { test } from "node:test";
import assert from "node:assert/strict";

import { buildDerivedDocuments } from "../../src/services/convert.ts";
import { SAMPLE_UBL, SAMPLE_CII, UBL_XML, CDAR_XML } from "../helpers.ts";

test("UBL upload derives a CII conversion and a readable PDF", async () => {
  const { documents, skipReason } = await buildDerivedDocuments(
    Buffer.from(SAMPLE_UBL, "utf8"),
    "UBL",
    "FA-TEST-001",
  );
  assert.equal(skipReason, undefined);
  assert.deepEqual(Object.keys(documents).sort(), ["Converted", "ReadableView"]);

  assert.equal(documents.Converted?.filename, "FA-TEST-001_cii.xml");
  assert.equal(documents.Converted?.contentType, "application/xml");
  assert.match(documents.Converted!.content.toString("utf8"), /CrossIndustryInvoice/);

  assert.equal(documents.ReadableView?.filename, "FA-TEST-001.pdf");
  assert.equal(documents.ReadableView?.contentType, "application/pdf");
  assert.equal(documents.ReadableView!.content.subarray(0, 5).toString("latin1"), "%PDF-");
});

test("CII upload derives a UBL conversion and a readable PDF", async () => {
  const { documents, skipReason } = await buildDerivedDocuments(
    Buffer.from(SAMPLE_CII, "utf8"),
    "CII",
    "FA-TEST-001",
  );
  assert.equal(skipReason, undefined);
  assert.deepEqual(Object.keys(documents).sort(), ["Converted", "ReadableView"]);
  assert.equal(documents.Converted?.filename, "FA-TEST-001_ubl.xml");
  assert.match(documents.Converted!.content.toString("utf8"), /urn:oasis:names:specification:ubl/);
});

test("filename falls back to the parsed invoice number when none is passed", async () => {
  const { documents } = await buildDerivedDocuments(Buffer.from(SAMPLE_UBL, "utf8"), "UBL", null);
  assert.equal(documents.Converted?.filename, "FA-TEST-001_cii.xml");
});

test("non-invoice syntaxes are skipped without an error reason", async () => {
  for (const syntax of ["CDAR", "FRR", "Factur-X", "Unknown"] as const) {
    const { documents, skipReason } = await buildDerivedDocuments(
      Buffer.from(CDAR_XML, "utf8"),
      syntax,
      null,
    );
    assert.deepEqual(documents, {}, `${syntax} should yield no documents`);
    assert.equal(skipReason, undefined, `${syntax} is an intentional skip, not an error`);
  }
});

test("an invoice with no parseable lines is skipped with a reason", async () => {
  const { documents, skipReason } = await buildDerivedDocuments(
    Buffer.from(UBL_XML, "utf8"),
    "UBL",
    "INV-UBL-001",
  );
  assert.deepEqual(documents, {});
  assert.ok(skipReason && skipReason.length > 0);
});

test("malformed content never throws and produces no documents", async () => {
  const { documents } = await buildDerivedDocuments(Buffer.from("garbage", "utf8"), "CII", null);
  assert.deepEqual(documents, {});
});
