import * as store from "../../services/store.ts";
import * as simulator from "../../services/simulator.ts";
import { LIFECYCLE_STATUSES } from "../../generators/cdar.ts";
import { sendError } from "../../utils/http.ts";

import type { Req, Res } from "../../utils/http.ts";

export function forceFlowStatus(req: Req, res: Res): Res | void {
  const flowId = String(req.params.flowId);
  const flow = store.getFlow(flowId);
  if (!flow) {
    return sendError(res, 404, "MISSING_RESOURCE", `Flux inconnu : ${flowId}`);
  }
  if (flow.flowSyntax === "CDAR") {
    return sendError(
      res,
      400,
      "NOT_AN_INVOICE",
      "Ce flux est déjà un statut de cycle de vie ; changez le statut du flux facture associé.",
    );
  }

  const body = req.body || {};
  if (!body.statusCode && !body.statusName) {
    return sendError(res, 400, "MISSING_REQUIRED_FIELD", "statusCode ou statusName requis.", {
      available: LIFECYCLE_STATUSES,
    });
  }
  const known = LIFECYCLE_STATUSES.find(
    (s) => s.code === String(body.statusCode) || s.name === body.statusName,
  );
  const statusCode = String(body.statusCode || (known && known.code) || "999");
  const statusName = body.statusName || (known && known.name) || "Statut personnalisé";

  store.updateFlowStatus(flow.flowId, { statusCode, statusName });

  let lifecycleFlow = null;
  const emitLC = body.emitLifecycleFlow !== false;
  if (emitLC) {
    const lcType = flow.flowType.startsWith("Customer") ? "CustomerInvoiceLC" : "SupplierInvoiceLC";
    const md = flow.metadata || {};
    lifecycleFlow = simulator.createLifecycleFlow({
      flowType: lcType,
      invoiceNumber: flow.invoiceNumber || flow.flowId,
      sellerSiret: (md.seller && md.seller.siret) || "00000000000000",
      buyerSiret: (md.buyer && md.buyer.siret) || "11111111111111",
      status: { code: statusCode, name: statusName },
      comment: body.comment || null,
    });
  }

  res.send({
    flow: store.toSummary(flow),
    lifecycleFlow: lifecycleFlow ? store.toSummary(lifecycleFlow) : null,
  });
}
