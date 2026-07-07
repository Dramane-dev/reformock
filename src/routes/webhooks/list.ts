import * as webhooks from "../../services/webhooks.ts";

import type { Req, Res } from "../../utils/http.ts";

export function getWebhooks(req: Req, res: Res): void {
  const list = webhooks.listWebhooks();
  res.send({ count: list.length, webhooks: list.map(webhooks.toWebhook) });
}
