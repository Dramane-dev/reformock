import * as webhooks from "../../services/webhooks.ts";
import { checkWebhookUrl } from "../../utils/ssrf.ts";
import { config } from "../../config.ts";
import { sendError } from "../../utils/http.ts";

import type { Req, Res } from "../../utils/http.ts";

export async function subscribeWebhook(req: Req, res: Res): Promise<Res | void> {
  const body = req.body || {};
  if (!body.callbackUrl || typeof body.callbackUrl !== "string") {
    return sendError(res, 400, "MISSING_REQUIRED_FIELD", "callbackUrl est obligatoire.");
  }
  if (webhooks.atCapacity()) {
    return sendError(
      res,
      403,
      "WEBHOOK_LIMIT_REACHED",
      `Nombre maximal de webhooks atteint (${config.webhooks.max}). Supprimez-en avant d'en créer un nouveau.`,
    );
  }
  const check = await checkWebhookUrl(body.callbackUrl);
  if (!check.ok) {
    return sendError(res, 400, "INVALID_CALLBACK_URL", check.reason);
  }
  const w = webhooks.createWebhook({
    callbackUrl: body.callbackUrl,
    flowTypes: body.flowTypes,
    flowDirection: body.flowDirection,
    ackStatus: body.ackStatus,
  });
  res.status(201).send(webhooks.toIdParam(w));
}
