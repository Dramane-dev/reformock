import * as webhooks from "../../services/webhooks.ts";
import { sendError } from "../../utils/http.ts";

import type { Req, Res } from "../../utils/http.ts";

export function unsubscribeWebhook(req: Req, res: Res): Res | void {
  const webhookUid = String(req.params.webhookUid);
  const ok = webhooks.deleteWebhook(webhookUid);
  if (!ok) {
    return sendError(res, 404, "MISSING_RESOURCE", `Webhook inconnu : ${webhookUid}`);
  }
  res.status(204).send();
}
