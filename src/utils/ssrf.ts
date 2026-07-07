import dns from "node:dns";

import { z } from "zod";

import { config } from "../config.ts";

export interface UrlCheck {
  ok: boolean;
  reason?: string;
}

export const ipv4Schema = z.ipv4();
export const ipv6Schema = z.ipv6();
export const webhookUrlSchema = z.url({ protocol: /^https?$/ });

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidr(ipInt: number, base: string, bits: number): boolean {
  const baseInt = ipv4ToInt(base);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function isPrivateIpv4(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);
  const ranges: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];
  return ranges.some(([base, bits]) => inCidr(ipInt, base, bits));
}

function isPrivateIpv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0];

  const mapped = addr.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    return isPrivateIpv4(mapped[1]);
  }

  if (addr === "::" || addr === "::1") {
    return true;
  }
  if (
    addr.startsWith("fe80") ||
    addr.startsWith("fe9") ||
    addr.startsWith("fea") ||
    addr.startsWith("feb")
  ) {
    return true;
  }
  if (addr.startsWith("fc") || addr.startsWith("fd")) {
    return true;
  }
  if (addr.startsWith("ff")) {
    return true;
  }
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  if (ipv4Schema.safeParse(ip).success) {
    return isPrivateIpv4(ip);
  }
  if (ipv6Schema.safeParse(ip).success) {
    return isPrivateIpv6(ip);
  }
  return true;
}

export async function checkWebhookUrl(rawUrl: string): Promise<UrlCheck> {
  if (!webhookUrlSchema.safeParse(rawUrl).success) {
    return { ok: false, reason: "callbackUrl doit être une URI http(s) valide." };
  }

  const url = new URL(rawUrl);

  if (url.username || url.password) {
    return { ok: false, reason: "callbackUrl ne doit pas contenir d'identifiants." };
  }

  if (config.webhooks.allowPrivate) {
    return { ok: true };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (ipv4Schema.safeParse(hostname).success || ipv6Schema.safeParse(hostname).success) {
    if (isPrivateAddress(hostname)) {
      return { ok: false, reason: "callbackUrl cible une adresse privée ou réservée." };
    }
    return { ok: true };
  }

  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  } catch {
    return { ok: false, reason: "callbackUrl : le nom d'hôte est introuvable." };
  }

  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    return { ok: false, reason: "callbackUrl résout vers une adresse privée ou réservée." };
  }

  return { ok: true };
}
