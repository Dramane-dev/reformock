import type { Company, InvoiceData } from "../types.ts";

function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateUBL(inv: InvoiceData): string {
  const { seller, buyer, totals } = inv;
  const lines = inv.lines
    .map(
      (l) => `
  <cac:InvoiceLine>
    <cbc:ID>${l.id}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${l.unit}">${l.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${inv.currency}">${l.lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc(l.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${l.vatRate}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${inv.currency}">${l.unitPrice.toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`,
    )
    .join("");

  const party = (p: Company, endpointSchemeId: string): string => `
    <cac:Party>
      <cbc:EndpointID schemeID="${endpointSchemeId}">${p.siret}</cbc:EndpointID>
      <cac:PartyIdentification><cbc:ID schemeID="0009">${p.siret}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${esc(p.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(p.address.line1)}</cbc:StreetName>
        <cbc:CityName>${esc(p.address.city)}</cbc:CityName>
        <cbc:PostalZone>${p.address.postalCode}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${p.address.countryCode}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${p.vatNumber}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(p.name)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="0002">${p.siren}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:cius-fr:2025</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${inv.invoiceNumber}</cbc:ID>
  <cbc:IssueDate>${inv.issueDate}</cbc:IssueDate>
  <cbc:DueDate>${inv.dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${inv.currency}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>${party(seller, "0009")}
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>${party(buyer, "0009")}
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cbc:PaymentID>${inv.invoiceNumber}</cbc:PaymentID>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${inv.currency}">${totals.totalVAT.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${inv.currency}">${totals.totalHT.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${inv.currency}">${totals.totalVAT.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${totals.vatRate}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${inv.currency}">${totals.totalHT.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${inv.currency}">${totals.totalHT.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${inv.currency}">${totals.totalTTC.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${inv.currency}">${totals.totalTTC.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lines}
</Invoice>
`;
}

export { generateUBL };
