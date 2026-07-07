import type { LifecycleStatus } from "../types.ts";

function esc(s: unknown): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const LIFECYCLE_STATUSES: readonly LifecycleStatus[] = [
  { code: "200", name: "Déposée" },
  { code: "201", name: "Rejetée", requiresReason: true },
  { code: "202", name: "Émise par la plateforme" },
  { code: "203", name: "Reçue par la plateforme" },
  { code: "204", name: "Mise à disposition" },
  { code: "205", name: "Prise en charge" },
  { code: "206", name: "Approuvée" },
  { code: "207", name: "Approuvée partiellement", requiresReason: true },
  { code: "208", name: "En litige", requiresReason: true },
  { code: "210", name: "Refusée", requiresReason: true },
  { code: "211", name: "Paiement transmis" },
  { code: "212", name: "Encaissée" },
];

const HAPPY_PATH: readonly string[] = ["202", "203", "204", "205", "206", "211", "212"];

interface GenerateCDARParams {
  invoiceNumber: string;
  statusCode: string;
  statusName: string;
  sellerSiret: string;
  buyerSiret: string;
  dateTime?: Date;
  comment?: string | null;
}

function generateCDAR({
  invoiceNumber,
  statusCode,
  statusName,
  sellerSiret,
  buyerSiret,
  dateTime,
  comment,
}: GenerateCDARParams): string {
  const ts = (dateTime || new Date()).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossDomainAcknowledgementAndResponse
    xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossDomainAcknowledgementAndResponse:100"
    xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
    xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:fdc:fr:2024:lifecycle:1.0</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>LC-${esc(invoiceNumber)}-${statusCode}</ram:ID>
    <ram:TypeCode>916</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="205">${ts}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:AcknowledgementDocument>
    <ram:ReferenceReferencedDocument>
      <ram:IssuerAssignedID>${esc(invoiceNumber)}</ram:IssuerAssignedID>
      <ram:TypeCode>380</ram:TypeCode>
    </ram:ReferenceReferencedDocument>
    <ram:StatusCode>${statusCode}</ram:StatusCode>
    <ram:StatusName>${esc(statusName)}</ram:StatusName>${
      comment
        ? `
    <ram:StatusReason>${esc(comment)}</ram:StatusReason>`
        : ""
    }
    <ram:SenderTradeParty>
      <ram:ID schemeID="0009">${buyerSiret}</ram:ID>
    </ram:SenderTradeParty>
    <ram:RecipientTradeParty>
      <ram:ID schemeID="0009">${sellerSiret}</ram:ID>
    </ram:RecipientTradeParty>
  </rsm:AcknowledgementDocument>
</rsm:CrossDomainAcknowledgementAndResponse>
`;
}

export { generateCDAR, LIFECYCLE_STATUSES, HAPPY_PATH };
