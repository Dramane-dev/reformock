import * as store from "../../services/store.ts";
import { sendError } from "../../utils/http.ts";

import type { Req, Res } from "../../utils/http.ts";

export function searchFlows(req: Req, res: Res): Res {
  const params = req.body || {};
  const where = params.where;
  if (!where || typeof where !== "object" || Object.keys(where).length === 0) {
    return sendError(
      res,
      400,
      "MISSING_REQUIRED_FIELD",
      "Au moins un critère est requis dans 'where'.",
    );
  }
  return res.send(store.searchSpec(params));
}
