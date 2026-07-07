import crypto from "node:crypto";

import * as store from "./store.ts";
import { config } from "../config.ts";
import { checkWebhookUrl } from "../utils/ssrf.ts";
import type {
  CreateWebhookParams,
  Flow,
  FlowDTO,
  WebhookDTO,
  WebhookIdParam,
  WebhookRecord,
} from "../types.ts";

const webhooks = new Map<string, WebhookRecord>();

function atCapacity(): boolean {
  return config.webhooks.max > 0 && webhooks.size >= config.webhooks.max;
}

function createWebhook({
  callbackUrl,
  flowTypes,
  flowDirection,
  ackStatus,
}: CreateWebhookParams): WebhookRecord {
  const keyBuf = crypto.randomBytes(32);
  const record: WebhookRecord = {
    webhookId: crypto.randomUUID(),
    signingKey: keyBuf.toString("base64"),
    signingKeyBuf: keyBuf,
    createdAt: new Date().toISOString(),
    callbackUrl,
    flowTypes: Array.isArray(flowTypes) ? flowTypes : undefined,
    flowDirection: flowDirection || undefined,
    ackStatus: ackStatus || undefined,
  };
  webhooks.set(record.webhookId, record);
  return record;
}

function listWebhooks(): WebhookRecord[] {
  return [...webhooks.values()];
}

function deleteWebhook(webhookId: string): boolean {
  return webhooks.delete(webhookId);
}

function toIdParam(w: WebhookRecord): WebhookIdParam {
  return { webhookId: w.webhookId, signingKey: w.signingKey, createdAt: w.createdAt };
}

function toWebhook(w: WebhookRecord): WebhookDTO {
  const out: WebhookDTO = { ...toIdParam(w), callbackUrl: w.callbackUrl };
  if (w.flowTypes) {
    out.flowTypes = w.flowTypes;
  }
  if (w.flowDirection) {
    out.flowDirection = w.flowDirection;
  }
  if (w.ackStatus) {
    out.ackStatus = w.ackStatus;
  }
  return out;
}

function matches(w: WebhookRecord, flow: Flow): boolean {
  if (w.flowTypes && w.flowTypes.length && !w.flowTypes.includes(flow.flowType)) {
    return false;
  }
  if (w.flowDirection && w.flowDirection !== flow.flowDirection) {
    return false;
  }
  if (w.ackStatus && (!flow.acknowledgement || w.ackStatus !== flow.acknowledgement.status)) {
    return false;
  }
  return true;
}

function sign(payload: string, timestamp: number, keyBuf: Buffer): string {
  const fingerprint = `${payload}@${timestamp}`;
  return crypto.createHmac("sha256", keyBuf).update(fingerprint).digest("base64");
}

async function post(w: WebhookRecord, flowObj: FlowDTO): Promise<void> {
  const check = await checkWebhookUrl(w.callbackUrl);
  if (!check.ok) {
    console.log(`[webhook] émission bloquée vers ${w.callbackUrl} : ${check.reason}`);
    return;
  }
  const payload = JSON.stringify(flowObj);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign(payload, timestamp, w.signingKeyBuf);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(w.callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Afnor-Signature": signature,
        "Afnor-Signature-Timestamp": String(timestamp),
      },
      body: payload,
      signal: controller.signal,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`[webhook] échec d'émission vers ${w.callbackUrl} : ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

function start(): void {
  store.subscribe((flow: Flow) => {
    if (webhooks.size === 0) {
      return;
    }
    const flowObj = store.toFlow(flow);
    for (const w of webhooks.values()) {
      if (matches(w, flow)) {
        void post(w, flowObj);
      }
    }
  });
}

export { createWebhook, listWebhooks, deleteWebhook, toIdParam, toWebhook, start, atCapacity };
