import { test } from "node:test";
import assert from "node:assert/strict";

import { isPrivateAddress, checkWebhookUrl } from "../../src/utils/ssrf.ts";

test("isPrivateAddress flags loopback and private IPv4 ranges", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.5",
    "172.16.3.4",
    "192.168.1.1",
    "169.254.10.10",
    "0.0.0.0",
  ]) {
    assert.equal(isPrivateAddress(ip), true, `${ip} should be private`);
  }
});

test("isPrivateAddress accepts public IPv4 addresses", () => {
  for (const ip of ["93.184.216.34", "8.8.8.8", "1.1.1.1"]) {
    assert.equal(isPrivateAddress(ip), false, `${ip} should be public`);
  }
});

test("isPrivateAddress flags loopback and unique-local IPv6", () => {
  for (const ip of ["::1", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, `${ip} should be private`);
  }
});

test("isPrivateAddress treats unparseable input as private (fail closed)", () => {
  assert.equal(isPrivateAddress("not-an-ip"), true);
});

test("checkWebhookUrl rejects non-http(s) protocols and malformed URLs", async () => {
  assert.equal((await checkWebhookUrl("not a url")).ok, false);
  assert.equal((await checkWebhookUrl("ftp://example.com/x")).ok, false);
});

test("checkWebhookUrl rejects URLs carrying credentials", async () => {
  const res = await checkWebhookUrl("https://user:pass@example.com/hook");
  assert.equal(res.ok, false);
});
