import { test } from "node:test";
import assert from "node:assert/strict";

import { generateUBL } from "../../src/generators/ubl.ts";
import { generateCII } from "../../src/generators/cii.ts";
import { parseUBLInvoice } from "../../src/parsers/ubl.ts";
import { parseCIIInvoice } from "../../src/parsers/cii.ts";
import { sampleInvoice, UBL_XML, CII_XML } from "../helpers.ts";

const inv = sampleInvoice();

test("parseUBLInvoice recovers the invoice from generated UBL", () => {
  const parsed = parseUBLInvoice(Buffer.from(generateUBL(inv), "utf8"));

  assert.equal(parsed.invoiceNumber, "FA-TEST-001");
  assert.equal(parsed.issueDate, "2026-03-01");
  assert.equal(parsed.dueDate, "2026-03-31");
  assert.equal(parsed.currency, "EUR");

  assert.equal(parsed.seller.name, "Vendeur Test");
  assert.equal(parsed.seller.siren, "111222333");
  assert.equal(parsed.seller.siret, "11122233300019");
  assert.equal(parsed.seller.vatNumber, "FR11111222333");
  assert.deepEqual(parsed.seller.address, inv.seller.address);

  assert.equal(parsed.buyer.name, "Acheteur & Fils");

  assert.equal(parsed.lines.length, 2);
  assert.deepEqual(parsed.lines[0], inv.lines[0]);
  assert.deepEqual(parsed.lines[1], inv.lines[1]);
  assert.deepEqual(parsed.totals, inv.totals);
});

test("parseCIIInvoice recovers the invoice from generated CII", () => {
  const parsed = parseCIIInvoice(Buffer.from(generateCII(inv), "utf8"));

  assert.equal(parsed.invoiceNumber, "FA-TEST-001");
  assert.equal(parsed.issueDate, "2026-03-01");
  assert.equal(parsed.dueDate, "2026-03-31");
  assert.equal(parsed.currency, "EUR");

  assert.equal(parsed.seller.name, "Vendeur Test");
  assert.equal(parsed.seller.siren, "111222333");
  assert.equal(parsed.seller.email, "vendeur@test.fr");
  assert.equal(parsed.seller.vatNumber, "FR11111222333");
  assert.deepEqual(parsed.seller.address, inv.seller.address);

  assert.equal(parsed.buyer.name, "Acheteur & Fils");

  assert.equal(parsed.lines.length, 2);
  assert.deepEqual(parsed.lines[0], inv.lines[0]);
  assert.deepEqual(parsed.totals, inv.totals);
});

test("known lossy fields: UBL carries no email, CII carries no SIRET", () => {
  const fromUbl = parseUBLInvoice(Buffer.from(generateUBL(inv), "utf8"));
  const fromCii = parseCIIInvoice(Buffer.from(generateCII(inv), "utf8"));
  assert.equal(fromUbl.seller.email, "");
  assert.equal(fromCii.seller.siret, "");
});

test("parsers tolerate default-namespace / prefixed XML without line items", () => {
  const ubl = parseUBLInvoice(Buffer.from(UBL_XML, "utf8"));
  assert.equal(ubl.invoiceNumber, "INV-UBL-001");
  assert.equal(ubl.seller.name, "Vendeur SARL");
  assert.equal(ubl.totals.totalTTC, 1200.5);
  assert.equal(ubl.lines.length, 0);

  const cii = parseCIIInvoice(Buffer.from(CII_XML, "utf8"));
  assert.equal(cii.invoiceNumber, "INV-CII-002");
  assert.equal(cii.issueDate, "2026-01-15");
  assert.equal(cii.seller.name, "Vendeur CII");
  assert.equal(cii.lines.length, 0);
});

test("parsers never throw on malformed input", () => {
  const junk = Buffer.from("this is not xml", "utf8");
  const ubl = parseUBLInvoice(junk);
  const cii = parseCIIInvoice(junk);
  assert.equal(ubl.lines.length, 0);
  assert.equal(cii.lines.length, 0);
  assert.equal(ubl.invoiceNumber, "");
  assert.equal(cii.invoiceNumber, "");
});
