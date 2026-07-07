import { LIFECYCLE_STATUSES } from "../../generators/cdar.ts";

import type { Req, Res } from "../../utils/http.ts";

export function getLifecycleStatuses(req: Req, res: Res): void {
  res.send({ statuses: LIFECYCLE_STATUSES });
}
