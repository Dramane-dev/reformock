import { getWebhooks } from "./list.ts";
import { subscribeWebhook } from "./subscribe.ts";
import { unsubscribeWebhook } from "./unsubscribe.ts";

import type { FastifyInstance } from "fastify";

export function registerWebhookRoutes(app: FastifyInstance): void {
  app.register(
    async (webhooks) => {
      webhooks.get("", getWebhooks);
      webhooks.post("", subscribeWebhook);
      webhooks.delete("/:webhookUid", unsubscribeWebhook);
    },
    { prefix: "/webhooks" },
  );
}
