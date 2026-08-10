import { generateCII } from "../generators/cii.ts";
import { generateUBL } from "../generators/ubl.ts";
import { generateReadablePDF } from "../generators/pdf.ts";
import { parseCIIInvoice } from "../parsers/cii.ts";
import { parseUBLInvoice } from "../parsers/ubl.ts";

import type { FlowDocuments, FlowSyntax, InvoiceData } from "../types.ts";

const CONVERTIBLE: ReadonlySet<FlowSyntax> = new Set<FlowSyntax>(["UBL", "CII"]);

export interface DerivedDocuments {
  documents: Pick<FlowDocuments, "Converted" | "ReadableView">;
  skipReason?: string;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function parseInvoice(raw: Buffer, syntax: FlowSyntax): InvoiceData {
  return syntax === "UBL" ? parseUBLInvoice(raw) : parseCIIInvoice(raw);
}

export async function buildDerivedDocuments(
  raw: Buffer,
  syntax: FlowSyntax,
  invoiceNumber: string | null,
): Promise<DerivedDocuments> {
  if (!CONVERTIBLE.has(syntax)) {
    return { documents: {} };
  }

  let invoice: InvoiceData;
  try {
    invoice = parseInvoice(raw, syntax);
  } catch (err) {
    return { documents: {}, skipReason: `parse failed: ${errorMessage(err)}` };
  }

  if (invoice.lines.length === 0) {
    return { documents: {}, skipReason: "no invoice lines parsed" };
  }

  const base = invoiceNumber || invoice.invoiceNumber || "invoice";
  try {
    const convertedXml = syntax === "UBL" ? generateCII(invoice) : generateUBL(invoice);
    const pdf = await generateReadablePDF(invoice);
    const convertedExt = syntax === "UBL" ? "cii" : "ubl";
    return {
      documents: {
        Converted: {
          content: Buffer.from(convertedXml, "utf8"),
          contentType: "application/xml",
          filename: `${base}_${convertedExt}.xml`,
        },
        ReadableView: {
          content: pdf,
          contentType: "application/pdf",
          filename: `${base}.pdf`,
        },
      },
    };
  } catch (err) {
    return { documents: {}, skipReason: `generation failed: ${errorMessage(err)}` };
  }
}
