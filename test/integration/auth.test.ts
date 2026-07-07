import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { newApp } from "../helpers.ts";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
before(async () => {
  app = await newApp();
});
after(() => app.close());

test("POST /oauth/token issues a token for client_credentials", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "client_credentials",
      client_id: "test-client",
      client_secret: "test-secret",
    },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.token_type, "Bearer");
  assert.ok(body.access_token);
  assert.equal(typeof body.expires_in, "number");
});

test("POST /oauth/token supports the password grant", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "password",
      client_id: "test-client",
      client_secret: "test-secret",
      username: "test-user",
      password: "test-password",
    },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().access_token);
});

test("POST /oauth/token accepts HTTP Basic client credentials", async () => {
  const basic = Buffer.from("test-client:test-secret").toString("base64");
  const res = await app.inject({
    method: "POST",
    url: "/oauth/token",
    headers: { authorization: `Basic ${basic}` },
    payload: { grant_type: "client_credentials" },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().access_token);
});

test("POST /oauth/token rejects a missing grant_type", async () => {
  const res = await app.inject({ method: "POST", url: "/oauth/token", payload: {} });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "invalid_request");
});

test("POST /oauth/token rejects an unsupported grant", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "authorization_code",
      client_id: "test-client",
      client_secret: "test-secret",
    },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "unsupported_grant_type");
});

test("POST /oauth/token rejects bad client credentials", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: { grant_type: "client_credentials", client_id: "test-client", client_secret: "WRONG" },
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, "invalid_client");
});

test("POST /oauth/token rejects bad password-grant user credentials", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "password",
      client_id: "test-client",
      client_secret: "test-secret",
      username: "test-user",
      password: "WRONG",
    },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "invalid_grant");
});

test("healthcheck is reachable without a bearer token", async () => {
  const res = await app.inject({ method: "GET", url: "/v1/healthcheck" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, "UP");
});

test("a secured route rejects a missing bearer token", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/v1/flows/search",
    payload: { where: { flowDirection: ["In"] } },
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().errorCode, "MISSING_TOKEN");
  assert.match(res.headers["www-authenticate"] as string, /Bearer/);
});

test("a secured route rejects an unknown bearer token", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/v1/flows/search",
    headers: { authorization: "Bearer deadbeef" },
    payload: { where: { flowDirection: ["In"] } },
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().errorCode, "INVALID_TOKEN");
});

test("a valid token unlocks a secured route", async () => {
  const tokenRes = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "client_credentials",
      client_id: "test-client",
      client_secret: "test-secret",
    },
  });
  const token = tokenRes.json().access_token;
  const res = await app.inject({
    method: "POST",
    url: "/v1/flows/search",
    headers: { authorization: `Bearer ${token}` },
    payload: { where: { flowDirection: ["In"] } },
  });
  assert.equal(res.statusCode, 200);
});
