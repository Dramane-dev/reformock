import type { Req, Res } from "../utils/http.ts";

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    value = value[0];
  }
  if (!value) {
    return undefined;
  }
  const first = value.split(",")[0].trim();
  return first || undefined;
}

function baseUrl(req: Req): string {
  const proto = firstHeaderValue(req.headers["x-forwarded-proto"]) || req.protocol || "http";
  const host = firstHeaderValue(req.headers["x-forwarded-host"]) || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

export function getOidcDiscovery(req: Req, res: Res): Res {
  const url = baseUrl(req);
  return res.header("Content-Type", "application/json; charset=utf-8").send({
    issuer: url,
    token_endpoint: `${url}/oauth/token`,
    jwks_uri: `${url}/.well-known/jwks.json`,
    grant_types_supported: ["client_credentials", "password"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    response_types_supported: ["token"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid"],
  });
}
