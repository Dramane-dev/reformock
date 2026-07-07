import type { FastifyReply, FastifyRequest } from "fastify";

export interface Req extends FastifyRequest {
  body: any;
  params: any;
  query: any;
}
export type Res = FastifyReply;

export function sendError(
  res: Res,
  status: number,
  errorCode: string,
  errorMessage?: string | null,
  extra?: Record<string, unknown>,
): Res {
  return res.status(status).send({ errorCode, errorMessage: errorMessage ?? null, ...extra });
}
