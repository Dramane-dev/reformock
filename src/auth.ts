import crypto from "node:crypto";

import { config } from "./config.ts";

import type { Req, Res } from "./utils/http.ts";

const {
  disabled: AUTH_DISABLED,
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  username: USERNAME,
  password: PASSWORD,
  tokenTtlSeconds: TOKEN_TTL_SECONDS,
} = config.auth;

const SUPPORTED_GRANTS = new Set(["client_credentials", "password"]);

const tokens = new Map<string, number>();

function safeEqual(a: string | undefined, b: string | undefined): boolean {
  const digestA = crypto
    .createHash("sha256")
    .update(a ?? "", "utf8")
    .digest();
  const digestB = crypto
    .createHash("sha256")
    .update(b ?? "", "utf8")
    .digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function issueToken(res: Res): Res {
  const now = Date.now();
  for (const [existing, expiry] of tokens) {
    if (expiry < now) {
      tokens.delete(existing);
    }
  }
  const token = crypto.randomBytes(32).toString("hex");
  tokens.set(token, now + TOKEN_TTL_SECONDS * 1000);
  return res.send({ access_token: token, token_type: "Bearer", expires_in: TOKEN_TTL_SECONDS });
}

function tokenEndpoint(req: Req, res: Res): Res {
  const body = req.body || {};
  let clientId: string | undefined = body.client_id;
  let clientSecret: string | undefined = body.client_secret;
  const authHeader = req.headers.authorization || "";
  if (!clientId && authHeader.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    [clientId, clientSecret] = decoded.split(":");
  }

  if (!body.grant_type) {
    return res
      .status(400)
      .send({ error: "invalid_request", error_description: "grant_type requis" });
  }
  if (!SUPPORTED_GRANTS.has(body.grant_type)) {
    return res.status(400).send({ error: "unsupported_grant_type" });
  }

  if (!safeEqual(clientId, CLIENT_ID) || !safeEqual(clientSecret, CLIENT_SECRET)) {
    return res.status(401).send({ error: "invalid_client" });
  }

  if (body.grant_type === "password") {
    if (!body.username || !body.password) {
      return res
        .status(400)
        .send({ error: "invalid_request", error_description: "username et password requis" });
    }
    if (!safeEqual(body.username, USERNAME) || !safeEqual(body.password, PASSWORD)) {
      return res
        .status(400)
        .send({ error: "invalid_grant", error_description: "identifiants utilisateur invalides" });
    }
  }

  return issueToken(res);
}

async function bearerMiddleware(req: Req, res: Res): Promise<Res | void> {
  if (AUTH_DISABLED) {
    return;
  }
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) {
    res.header("WWW-Authenticate", 'Bearer realm="flow-service"');
    return res
      .status(401)
      .send({ errorCode: "MISSING_TOKEN", errorMessage: "Bearer token requis (RFC 6750)" });
  }
  const token = h.slice(7);
  const expiry = tokens.get(token);
  if (!expiry || expiry < Date.now()) {
    res.header("WWW-Authenticate", 'Bearer realm="flow-service", error="invalid_token"');
    return res
      .status(401)
      .send({ errorCode: "INVALID_TOKEN", errorMessage: "Jeton inconnu ou expiré" });
  }
}

export {
  tokenEndpoint,
  bearerMiddleware,
  AUTH_DISABLED,
  CLIENT_ID,
  CLIENT_SECRET,
  USERNAME,
  PASSWORD,
};
