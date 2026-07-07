import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { newApp, getToken, authHeader } from "../helpers.ts";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let token: string;

before(async () => {
  app = await newApp();
  token = await getToken(app);
});
after(() => app.close());

test("unknown routes return the contract Error shape (404)", async () => {
  const res = await app.inject({ method: "GET", url: "/v1/does/not/exist" });
  assert.equal(res.statusCode, 404);
  const body = res.json();
  assert.equal(body.errorCode, "MISSING_RESOURCE");
  assert.ok(typeof body.errorMessage === "string");
});

test("malformed JSON bodies are reported as MALFORMED_JSON (400)", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/v1/flows/search",
    headers: { ...authHeader(token), "content-type": "application/json" },
    payload: "{ this is not json",
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().errorCode, "MALFORMED_JSON");
});

test("GET /config.js exposes client bootstrap info", async () => {
  const res = await app.inject({ method: "GET", url: "/config.js" });
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers["content-type"]), /javascript/);
  assert.match(res.body, /window\.__REFORMOCK_CONFIG__/);
  assert.match(res.body, /"apiPrefix":"\/v1"/);
  assert.match(res.body, /"authDisabled":false/);
});
