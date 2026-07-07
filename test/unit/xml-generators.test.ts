import { test } from "node:test";
import assert from "node:assert/strict";

import { generateUBL } from "../../src/generators/ubl.ts";
import { generateCII } from "../../src/generators/cii.ts";
import { generateCDAR } from "../../src/generators/cdar.ts";
import { generateReadablePDF } from "../../src/generators/pdf.ts";
import { parseFlowFile } from "../../src/utils/parse.ts";
import type { InvoiceData } from "../../src/types.ts";

const INVOICE: InvoiceData = {
  invoiceNumber: "FA-2026-4242",
  issueDate: "2026-03-04",
  dueDate: "2026-04-03",
  currency: "EUR",
  seller: {
    name: "Vendeur & Fils",
    siren: "123456789",
    siret: "12345678900011",
    vatNumber: "FR32123456789",
    address: { line1: "1 rue du Test", postalCode: "75001", city: "Paris", countryCode: "FR" },
  },
  buyer: {
    name: "Acheteur SAS",
    siren: "987654321",
    siret: "98765432100022",
    vatNumber: "FR40987654321",
    address: { line1: "2 avenue Client", postalCode: "69002", city: "Lyon", countryCode: "FR" },
  },
  lines: [
    {
      id: 1,
      name: "Conseil",
      unit: "DAY",
      unitPrice: 850,
      quantity: 2,
      lineTotal: 1700,
      vatRate: 20,
    },
    {
      id: 2,
      name: "Licence <A&B>",
      unit: "C62",
      unitPrice: 100,
      quantity: 3,
      lineTotal: 300,
      vatRate: 20,
    },
  ],
  totals: { totalHT: 2000, totalVAT: 400, vatRate: 20, totalTTC: 2400 },
};

test("generateUBL round-trips through the parser", () => {
  const xml = generateUBL(INVOICE);
  const parsed = parseFlowFile(Buffer.from(xml, "utf8"));
  assert.equal(parsed.flowSyntax, "UBL");
  assert.equal(parsed.invoiceNumber, "FA-2026-4242");
  assert.equal(parsed.metadata.currency, "EUR");
  assert.equal(parsed.metadata.totalInclVat, 2400);
  assert.equal(parsed.metadata.issueDate, "2026-03-04");
  assert.equal(parsed.metadata.seller?.name, "Vendeur &amp; Fils");
});

test("generateUBL escapes XML special characters", () => {
  const xml = generateUBL(INVOICE);
  assert.ok(xml.includes("Vendeur &amp; Fils"), "ampersand should be escaped");
  assert.ok(xml.includes("Licence &lt;A&amp;B&gt;"), "line name should be escaped");
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml), "no raw ampersands");
});

test("generateCII round-trips through the parser", () => {
  const xml = generateCII(INVOICE);
  const parsed = parseFlowFile(Buffer.from(xml, "utf8"));
  assert.equal(parsed.flowSyntax, "CII");
  assert.equal(parsed.invoiceNumber, "FA-2026-4242");
  assert.equal(parsed.metadata.currency, "EUR");
  assert.equal(parsed.metadata.totalInclVat, 2400);
  assert.equal(parsed.metadata.issueDate, "2026-03-04");
  assert.equal(parsed.metadata.seller?.name, "Vendeur &amp; Fils");
});

test("generateCDAR embeds status and round-trips through the parser", () => {
  const xml = generateCDAR({
    invoiceNumber: "FA-2026-4242",
    statusCode: "210",
    statusName: "Refusée",
    sellerSiret: "12345678900011",
    buyerSiret: "98765432100022",
    comment: "Montant erroné",
  });
  assert.ok(xml.includes("<ram:StatusReason>Montant erroné</ram:StatusReason>"));
  const parsed = parseFlowFile(Buffer.from(xml, "utf8"));
  assert.equal(parsed.flowSyntax, "CDAR");
  assert.equal(parsed.invoiceNumber, "FA-2026-4242");
  assert.equal(parsed.metadata.statusCode, "210");
  assert.equal(parsed.metadata.statusName, "Refusée");
});

test("generateCDAR omits StatusReason when no comment is given", () => {
  const xml = generateCDAR({
    invoiceNumber: "X",
    statusCode: "206",
    statusName: "Approuvée",
    sellerSiret: "1",
    buyerSiret: "2",
  });
  assert.ok(!xml.includes("StatusReason"));
});

test("generateReadablePDF returns a real PDF buffer", async () => {
  const pdf = await generateReadablePDF(INVOICE);
  assert.ok(Buffer.isBuffer(pdf));
  assert.ok(pdf.length > 0);
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.equal(parseFlowFile(pdf).flowSyntax, "Factur-X");
});
