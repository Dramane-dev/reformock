import * as store from "../../services/store.ts";
import { buildDerivedDocuments } from "../../services/convert.ts";
import { parseFlowFile } from "../../utils/parse.ts";
import { sendError } from "../../utils/http.ts";

import type { Req, Res } from "../../utils/http.ts";
import type { UploadedFile } from "../../utils/upload.ts";

export async function adminInjectFlows(req: Req, res: Res): Promise<Res | void> {
  const body = req.body || {};
  const files: UploadedFile[] = req.uploadedFiles ?? [];
  if (files.length === 0) {
    return sendError(
      res,
      400,
      "MISSING_REQUIRED_FIELD",
      "Aucun fichier reçu (champ multipart 'files').",
    );
  }
  const flowDirection = body.flowDirection === "Out" ? "Out" : "In";
  const requestedType = body.flowType;
  const trackingId: string | null = body.trackingId || null;

  const created = [];
  for (const f of files) {
    const parsed = parseFlowFile(f.buffer);
    let flowType: string | undefined = requestedType;
    if (!flowType) {
      if (parsed.flowSyntax === "CDAR") {
        flowType = flowDirection === "In" ? "CustomerInvoiceLC" : "SupplierInvoiceLC";
      } else {
        flowType = flowDirection === "In" ? "SupplierInvoice" : "CustomerInvoice";
      }
    }
    const derived = await buildDerivedDocuments(f.buffer, parsed.flowSyntax, parsed.invoiceNumber);
    if (derived.skipReason) {
      req.log.warn(
        {
          flowSyntax: parsed.flowSyntax,
          invoiceNumber: parsed.invoiceNumber,
          reason: derived.skipReason,
        },
        "Uploaded invoice not converted",
      );
    }
    const flow = store.createFlow({
      flowType,
      flowDirection,
      flowSyntax: parsed.flowSyntax,
      trackingId,
      invoiceNumber: parsed.invoiceNumber,
      statusCode: parsed.metadata.statusCode || null,
      statusName: parsed.metadata.statusName || null,
      metadata: {
        ...parsed.metadata,
        injectedVia: "web-console",
        receivedFilename: f.originalname,
        size: f.buffer.length,
      },
      documents: {
        Original: {
          content: f.buffer,
          contentType: f.mimetype || "application/xml",
          filename: f.originalname,
        },
        ...(derived.skipReason === undefined && derived.documents),
      },
    });
    created.push(store.toSummary(flow));
  }
  res.status(201).send({ injected: created.length, flows: created });
}
