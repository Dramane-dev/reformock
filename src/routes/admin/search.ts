import * as store from "../../services/store.ts";

import type { Req, Res } from "../../utils/http.ts";

export function adminSearchFlows(req: Req, res: Res): void {
  res.send(store.searchInternal(req.body || {}));
}
