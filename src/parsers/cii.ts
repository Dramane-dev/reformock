import { attr, num, pick, picks, text } from "./xml.ts";

import type { Address, Company, InvoiceData, InvoiceLine, InvoiceTotals } from "../types.ts";

function emptyAddress(): Address {
  return { line1: "", postalCode: "", city: "", countryCode: "" };
}

function normaliseDate(raw: string | null): string {
  if (!raw) {
    return "";
  }
  const digits = raw.trim();
  if (/^\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return digits;
}

function parseParty(partyBlock: string): Company {
  const legalOrg = pick(partyBlock, "SpecifiedLegalOrganization");
  const uri = pick(partyBlock, "URIUniversalCommunication");
  const taxReg = pick(partyBlock, "SpecifiedTaxRegistration");
  const postal = pick(partyBlock, "PostalTradeAddress");

  const address = emptyAddress();
  if (postal) {
    address.line1 = text(postal, "LineOne") || "";
    address.city = text(postal, "CityName") || "";
    address.postalCode = text(postal, "PostcodeCode") || "";
    address.countryCode = text(postal, "CountryID") || "";
  }

  return {
    name: text(partyBlock, "Name") || "",
    siren: text(legalOrg, "ID") || "",
    siret: "",
    email: text(uri, "URIID") || "",
    vatNumber: text(taxReg, "ID") || "",
    address,
  };
}

function parseLine(lineBlock: string): InvoiceLine {
  const doc = pick(lineBlock, "AssociatedDocumentLineDocument");
  const product = pick(lineBlock, "SpecifiedTradeProduct");
  const agreement = pick(lineBlock, "SpecifiedLineTradeAgreement");
  const netPrice = pick(agreement, "NetPriceProductTradePrice");
  const delivery = pick(lineBlock, "SpecifiedLineTradeDelivery");
  const settlement = pick(lineBlock, "SpecifiedLineTradeSettlement");
  const tax = pick(settlement, "ApplicableTradeTax");
  const summation = pick(settlement, "SpecifiedTradeSettlementLineMonetarySummation");

  return {
    id: parseInt(text(doc, "LineID") || "0", 10) || 0,
    name: text(product, "Name") || "",
    unit: attr(delivery || lineBlock, "BilledQuantity", "unitCode") || "",
    quantity: num(delivery, "BilledQuantity") ?? 0,
    unitPrice: num(netPrice, "ChargeAmount") ?? 0,
    lineTotal: num(summation, "LineTotalAmount") ?? 0,
    vatRate: num(tax, "RateApplicablePercent") ?? 0,
  };
}

function parseTotals(xml: string): InvoiceTotals {
  const settlement = pick(xml, "ApplicableHeaderTradeSettlement");
  const summation = pick(settlement, "SpecifiedTradeSettlementHeaderMonetarySummation");
  const headerTax = pick(settlement, "ApplicableTradeTax");

  const totalHT = num(summation, "LineTotalAmount") ?? num(summation, "TaxBasisTotalAmount") ?? 0;
  const totalVAT = num(summation, "TaxTotalAmount") ?? 0;
  const totalTTC = num(summation, "GrandTotalAmount") ?? num(summation, "DuePayableAmount") ?? 0;
  const vatRate = num(headerTax, "RateApplicablePercent") ?? 0;

  return { totalHT, totalVAT, vatRate, totalTTC };
}

export function parseCIIInvoice(content: Buffer): InvoiceData {
  const xml = content.toString("utf8");

  const exchangedDoc = pick(xml, "ExchangedDocument");
  const issueDateTime = pick(exchangedDoc, "IssueDateTime");
  const paymentTerms = pick(xml, "SpecifiedTradePaymentTerms");
  const dueDateTime = pick(paymentTerms, "DueDateDateTime");

  return {
    invoiceNumber: text(exchangedDoc, "ID") || "",
    issueDate: normaliseDate(text(issueDateTime, "DateTimeString")),
    dueDate: normaliseDate(text(dueDateTime, "DateTimeString")),
    currency: text(xml, "InvoiceCurrencyCode") || "",
    seller: parseParty(pick(xml, "SellerTradeParty") || ""),
    buyer: parseParty(pick(xml, "BuyerTradeParty") || ""),
    lines: picks(xml, "IncludedSupplyChainTradeLineItem").map(parseLine),
    totals: parseTotals(xml),
  };
}
