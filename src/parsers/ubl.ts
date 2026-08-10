import { attr, num, pick, picks, text } from "./xml.ts";

import type { Address, Company, InvoiceData, InvoiceLine, InvoiceTotals } from "../types.ts";

function emptyAddress(): Address {
  return { line1: "", postalCode: "", city: "", countryCode: "" };
}

function parseParty(partyBlock: string): Company {
  const legalEntity = pick(partyBlock, "PartyLegalEntity");
  const partyName = pick(partyBlock, "PartyName");
  const identification = pick(partyBlock, "PartyIdentification");
  const taxScheme = pick(partyBlock, "PartyTaxScheme");
  const postal = pick(partyBlock, "PostalAddress");

  const name = text(legalEntity, "RegistrationName") || text(partyName, "Name") || "";
  const siret = text(identification, "ID") || text(partyBlock, "EndpointID") || "";
  const siren = text(legalEntity, "CompanyID") || "";
  const vatNumber = text(taxScheme, "CompanyID") || "";
  const email = text(partyBlock, "ElectronicMail") || "";

  const address = emptyAddress();
  if (postal) {
    address.line1 = text(postal, "StreetName") || "";
    address.city = text(postal, "CityName") || "";
    address.postalCode = text(postal, "PostalZone") || "";
    address.countryCode = text(pick(postal, "Country"), "IdentificationCode") || "";
  }

  return { name, siren, siret, email, vatNumber, address };
}

function parseLine(lineBlock: string): InvoiceLine {
  const item = pick(lineBlock, "Item");
  const price = pick(lineBlock, "Price");
  const taxCategory = pick(item, "ClassifiedTaxCategory");

  return {
    id: parseInt(text(lineBlock, "ID") || "0", 10) || 0,
    name: text(item, "Name") || "",
    unit: attr(lineBlock, "InvoicedQuantity", "unitCode") || "",
    quantity: num(lineBlock, "InvoicedQuantity") ?? 0,
    unitPrice: num(price, "PriceAmount") ?? 0,
    lineTotal: num(lineBlock, "LineExtensionAmount") ?? 0,
    vatRate: num(taxCategory, "Percent") ?? 0,
  };
}

function parseTotals(xml: string): InvoiceTotals {
  const monetary = pick(xml, "LegalMonetaryTotal");
  const taxTotal = pick(xml, "TaxTotal");
  const taxCategory = pick(taxTotal, "TaxCategory");

  const totalHT = num(monetary, "TaxExclusiveAmount") ?? num(monetary, "LineExtensionAmount") ?? 0;
  const totalTTC = num(monetary, "TaxInclusiveAmount") ?? num(monetary, "PayableAmount") ?? 0;
  const totalVAT = num(taxTotal, "TaxAmount") ?? totalTTC - totalHT;
  const vatRate = num(taxCategory, "Percent") ?? 0;

  return { totalHT, totalVAT, vatRate, totalTTC };
}

export function parseUBLInvoice(content: Buffer): InvoiceData {
  const xml = content.toString("utf8");

  const beforeSupplier = xml.split(/<(?:[\w.-]+:)?AccountingSupplierParty\b/)[0];

  const supplier = pick(xml, "AccountingSupplierParty");
  const customer = pick(xml, "AccountingCustomerParty");

  return {
    invoiceNumber: text(beforeSupplier, "ID") || "",
    issueDate: text(xml, "IssueDate") || "",
    dueDate: text(xml, "DueDate") || "",
    currency: text(xml, "DocumentCurrencyCode") || "",
    seller: parseParty(pick(supplier, "Party") || supplier || ""),
    buyer: parseParty(pick(customer, "Party") || customer || ""),
    lines: picks(xml, "InvoiceLine").map(parseLine),
    totals: parseTotals(xml),
  };
}
