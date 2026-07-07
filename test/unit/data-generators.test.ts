import { test } from "node:test";
import assert from "node:assert/strict";

import { generateCompany, generateInvoiceData, pick, randInt } from "../../src/generators/data.ts";

function luhnValid(num: string): boolean {
  const digits = num.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[digits.length - 1 - i]!;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) {
        d -= 9;
      }
    }
    sum += d;
  }
  return sum % 10 === 0;
}

test("generateCompany produces Luhn-valid SIREN (9) and SIRET (14)", () => {
  for (let i = 0; i < 200; i++) {
    const c = generateCompany();
    assert.equal(c.siren.length, 9, `SIREN length: ${c.siren}`);
    assert.equal(c.siret.length, 14, `SIRET length: ${c.siret}`);
    assert.ok(luhnValid(c.siren), `SIREN not Luhn-valid: ${c.siren}`);
    assert.ok(luhnValid(c.siret), `SIRET not Luhn-valid: ${c.siret}`);
    assert.ok(c.siret.startsWith(c.siren), "SIRET should start with SIREN");
  }
});

test("generateCompany produces a coherent French VAT number", () => {
  for (let i = 0; i < 100; i++) {
    const c = generateCompany();
    assert.match(c.vatNumber, /^FR\d{2}\d{9}$/, `bad VAT format: ${c.vatNumber}`);
    const siren = c.vatNumber.slice(4);
    const expectedKey = (12 + 3 * (parseInt(siren, 10) % 97)) % 97;
    assert.equal(c.vatNumber.slice(2, 4), String(expectedKey).padStart(2, "0"));
    assert.equal(siren, c.siren);
    assert.equal(c.address.countryCode, "FR");
  }
});

test("generateCompany honours an explicit name", () => {
  assert.equal(generateCompany("My Corp").name, "My Corp");
});

test("generateInvoiceData is internally consistent", () => {
  for (let i = 0; i < 100; i++) {
    const inv = generateInvoiceData();
    assert.match(inv.invoiceNumber, /^FA-\d{4}-\d+$/);
    assert.equal(inv.currency, "EUR");
    assert.ok(inv.lines.length >= 1 && inv.lines.length <= 4);

    const lineSum = Math.round(inv.lines.reduce((a, l) => a + l.lineTotal, 0) * 100) / 100;
    assert.equal(inv.totals.totalHT, lineSum, "HT should equal the sum of line totals");

    const expectedVat = Math.round(((inv.totals.totalHT * inv.totals.vatRate) / 100) * 100) / 100;
    assert.equal(inv.totals.totalVAT, expectedVat);
    assert.equal(
      inv.totals.totalTTC,
      Math.round((inv.totals.totalHT + inv.totals.totalVAT) * 100) / 100,
    );

    for (const l of inv.lines) {
      assert.equal(l.lineTotal, Math.round(l.quantity * l.unitPrice * 100) / 100);
    }

    const diff = (Date.parse(inv.dueDate) - Date.parse(inv.issueDate)) / 86400000;
    assert.equal(diff, 30);
  }
});

test("generateInvoiceData accepts injected seller/buyer", () => {
  const seller = generateCompany("Seller Co");
  const buyer = generateCompany("Buyer Co");
  const inv = generateInvoiceData({ seller, buyer });
  assert.equal(inv.seller.name, "Seller Co");
  assert.equal(inv.buyer.name, "Buyer Co");
});

test("randInt stays within the inclusive bounds", () => {
  for (let i = 0; i < 1000; i++) {
    const n = randInt(3, 7);
    assert.ok(n >= 3 && n <= 7, `out of range: ${n}`);
    assert.ok(Number.isInteger(n));
  }
  assert.equal(randInt(5, 5), 5);
});

test("pick always returns an element of the array", () => {
  const arr = ["a", "b", "c"] as const;
  for (let i = 0; i < 100; i++) {
    assert.ok(arr.includes(pick(arr)));
  }
});
