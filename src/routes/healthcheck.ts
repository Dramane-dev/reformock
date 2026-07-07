import type { Req, Res } from "../utils/http.ts";

export function getHealthcheck(req: Req, res: Res): void {
  res.send({ status: "UP", service: "reformock", time: new Date().toISOString() });
}
