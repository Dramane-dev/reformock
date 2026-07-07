import * as store from "../../services/store.ts";
import * as simulator from "../../services/simulator.ts";

import type { Req, Res } from "../../utils/http.ts";

export async function adminGenerate(req: Req, res: Res): Promise<void> {
  const count = Math.min(parseInt((req.body || {}).count || "1", 10) || 1, 100);
  const created = [];
  for (let i = 0; i < count; i++) {
    created.push(store.toSummary(await simulator.createIncomingInvoiceFlow()));
  }
  res.status(201).send({ generated: created.length, flows: created });
}
