import type { Company, InvoiceData } from "../types.ts";

function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dt(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function generateCII(inv: InvoiceData): string {
  const { seller, buyer, totals } = inv;

  const lines = inv.lines
    .map(
      (l) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${l.id}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(l.name)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${l.unitPrice.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${l.unit}">${l.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${l.vatRate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${l.lineTotal.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`,
    )
    .join("");

  const party = (p: Company): string => `
        <ram:Name>${esc(p.name)}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${p.siren}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${p.address.postalCode}</ram:PostcodeCode>
          <ram:LineOne>${esc(p.address.line1)}</ram:LineOne>
          <ram:CityName>${esc(p.address.city)}</ram:CityName>
          <ram:CountryID>${p.address.countryCode}</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">${p.email}</ram:URIID>
        </ram:URIUniversalCommunication>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${p.vatNumber}</ram:ID>
        </ram:SpecifiedTaxRegistration>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
                          xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
                          xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${inv.invoiceNumber}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${dt(inv.issueDate)}</udt:DateTimeString></ram:IssueDateTime>
    <ram:IncludedNote>
      <ram:Content>Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 €</ram:Content>
      <ram:SubjectCode>PMT</ram:SubjectCode>
    </ram:IncludedNote>
    <ram:IncludedNote>
      <ram:Content>Taux des pénalités de retard : 12,15 % (taux BCE + 10 points)</ram:Content>
      <ram:SubjectCode>PMD</ram:SubjectCode>
    </ram:IncludedNote>
    <ram:IncludedNote>
      <ram:Content>Pas d'escompte pour paiement anticipé</ram:Content>
      <ram:SubjectCode>AAB</ram:SubjectCode>
    </ram:IncludedNote>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lines}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>${party(seller)}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>${party(buyer)}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${inv.currency}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>30</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>FR3710096000704155525246C13</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${totals.totalVAT.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${totals.totalHT.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${totals.vatRate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime><udt:DateTimeString format="102">${dt(inv.dueDate)}</udt:DateTimeString></ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${totals.totalHT.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${totals.totalHT.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${inv.currency}">${totals.totalVAT.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${totals.totalTTC.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${totals.totalTTC.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}

export { generateCII };
