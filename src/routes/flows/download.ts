import * as store from "../../services/store.ts";
import { sendError } from "../../utils/http.ts";

import type { Req, Res } from "../../utils/http.ts";
import type { DocType } from "../../types.ts";

export function downloadFlow(req: Req, res: Res): Res | void {
  const flowId = String(req.params.flowId);
  const flow = store.getFlow(flowId);
  if (!flow) {
    return sendError(res, 404, "MISSING_RESOURCE", `Flux inconnu : ${flowId}`);
  }

  const docType = String(req.query.docType ?? "Metadata");
  const allowed = ["Metadata", "Original", "Converted", "ReadableView"] as const;
  if (!(allowed as readonly string[]).includes(docType)) {
    return sendError(res, 400, "INVALID_DOCTYPE", `docType doit être : ${allowed.join(", ")}`);
  }

  if (docType === "Metadata") {
    return res.send(store.toFlow(flow));
  }

  const doc = flow.documents[docType as DocType];
  if (!doc) {
    return sendError(
      res,
      404,
      "MISSING_RESOURCE",
      `Composant '${docType}' indisponible pour ce flux. Disponibles : ${Object.keys(flow.documents).join(", ") || "aucun"}`,
    );
  }

  res.headers({
    "Content-Type": doc.contentType || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${doc.filename}"`,
    "X-Flow-Id": flow.flowId,
    "X-Flow-Type": flow.flowType,
    "X-Doc-Type": docType,
  });
  res.send(doc.content);
}
