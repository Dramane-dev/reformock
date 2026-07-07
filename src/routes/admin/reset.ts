import * as store from "../../services/store.ts";

import type { Req, Res } from "../../utils/http.ts";

export function adminReset(req: Req, res: Res): void {
  store.resetStore();
  res.send({ message: "Store réinitialisé", total: store.count() });
}
