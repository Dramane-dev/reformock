import crypto from "node:crypto";

import { config } from "../config.ts";
import type {
  CreateFlowParams,
  Flow,
  FlowDTO,
  FlowStatusUpdate,
  FlowSummary,
  FlowSyntax,
  FullFlowInfo,
  InternalSearchCriteria,
  InternalSearchResult,
  SearchParams,
  SearchSpecResult,
} from "../types.ts";

type FlowListener = (flow: Flow) => void;

const flows = new Map<string, Flow>();

const MAX_FLOWS = config.store.maxFlows;
const MAX_STORE_BYTES = config.store.maxStoreBytes;

let totalBytes = 0;

function flowBytes(flow: Flow): number {
  let sum = 0;
  for (const doc of Object.values(flow.documents)) {
    if (doc && doc.content) {
      sum += doc.content.length;
    }
  }
  return sum;
}

function evictIfNeeded(): void {
  while (flows.size > 1) {
    const overCount = MAX_FLOWS > 0 && flows.size > MAX_FLOWS;
    const overBytes = MAX_STORE_BYTES > 0 && totalBytes > MAX_STORE_BYTES;
    if (!overCount && !overBytes) {
      break;
    }
    const oldest = flows.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    const evicted = flows.get(oldest);
    if (evicted) {
      totalBytes -= flowBytes(evicted);
    }
    flows.delete(oldest);
  }
}

const listeners: FlowListener[] = [];

function subscribe(fn: FlowListener): void {
  listeners.push(fn);
}

function emit(flow: Flow): void {
  for (const fn of listeners) {
    try {
      fn(flow);
    } catch {}
  }
}

function deriveProfile(flowSyntax: FlowSyntax): string {
  if (["CDAR", "FRR", "Unknown"].includes(flowSyntax)) {
    return "Undefined";
  }
  return "CIUS";
}

function sha256Hex(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function createFlow({
  flowType,
  flowDirection,
  flowSyntax,
  name = null,
  flowProfile = null,
  processingRule = "B2B",
  processingRuleSource = "Computed",
  acknowledgement = null,
  sha256 = null,
  trackingId = null,
  invoiceNumber = null,
  statusCode = null,
  statusName = null,
  metadata = {},
  documents = {},
}: CreateFlowParams): Flow {
  const now = new Date().toISOString();
  const original = documents.Original;
  const flow: Flow = {
    flowId: crypto.randomUUID(),
    trackingId,
    name: name || (original && original.filename) || "flow.xml",
    flowType,
    flowDirection,
    flowSyntax,
    flowProfile: flowProfile || deriveProfile(flowSyntax),
    processingRule: processingRule || "Undefined",
    processingRuleSource: processingRuleSource || "Computed",
    acknowledgement: acknowledgement || { status: "Ok" },
    sha256: sha256 || (original ? sha256Hex(original.content) : null),
    submittedAt: now,
    updatedAt: now,
    invoiceNumber,
    statusCode,
    statusName,
    metadata,
    documents,
  };
  flows.set(flow.flowId, flow);
  totalBytes += flowBytes(flow);
  evictIfNeeded();
  emit(flow);
  return flow;
}

function getFlow(flowId: string): Flow | null {
  return flows.get(flowId) || null;
}

function updateFlowStatus(
  flowId: string,
  { statusCode, statusName, ackStatus }: FlowStatusUpdate,
): Flow | null {
  const flow = flows.get(flowId);
  if (!flow) {
    return null;
  }
  if (statusCode !== undefined) {
    flow.statusCode = statusCode;
  }
  if (statusName !== undefined) {
    flow.statusName = statusName;
  }
  if (ackStatus) {
    flow.acknowledgement = { ...flow.acknowledgement, status: ackStatus };
  }
  flow.updatedAt = new Date().toISOString();
  emit(flow);
  return flow;
}

function toFullFlowInfo(flow: Flow): FullFlowInfo {
  const out: FullFlowInfo = {
    flowId: flow.flowId,
    submittedAt: flow.submittedAt,
    name: flow.name,
    flowSyntax: flow.flowSyntax,
  };
  if (flow.trackingId != null) {
    out.trackingId = flow.trackingId;
  }
  if (flow.processingRule != null) {
    out.processingRule = flow.processingRule;
  }
  if (flow.flowProfile != null) {
    out.flowProfile = flow.flowProfile;
  }
  if (flow.sha256 != null) {
    out.sha256 = flow.sha256;
  }
  return out;
}

function toFlow(flow: Flow): FlowDTO {
  const out: FlowDTO = {
    flowId: flow.flowId,
    submittedAt: flow.submittedAt,
    updatedAt: flow.updatedAt,
    name: flow.name,
    flowSyntax: flow.flowSyntax,
    flowProfile: flow.flowProfile,
    flowType: flow.flowType,
    flowDirection: flow.flowDirection,
    processingRule: flow.processingRule,
    processingRuleSource: flow.processingRuleSource,
    acknowledgement: flow.acknowledgement,
  };
  if (flow.trackingId != null) {
    out.trackingId = flow.trackingId;
  }
  return out;
}

function toSummary(flow: Flow): FlowSummary {
  return {
    flowId: flow.flowId,
    trackingId: flow.trackingId,
    name: flow.name,
    flowType: flow.flowType,
    flowDirection: flow.flowDirection,
    flowSyntax: flow.flowSyntax,
    flowProfile: flow.flowProfile,
    processingRule: flow.processingRule,
    acknowledgement: flow.acknowledgement,
    invoiceNumber: flow.invoiceNumber,
    statusCode: flow.statusCode,
    statusName: flow.statusName,
    submittedAt: flow.submittedAt,
    updatedAt: flow.updatedAt,
    createdDate: flow.submittedAt,
    updatedDate: flow.updatedAt,
    availableDocTypes: Object.keys(flow.documents),
    metadata: flow.metadata,
  };
}

interface CursorBookmark {
  u: string;
  i: string;
}

function encodeCursor(flow: Flow): string {
  return Buffer.from(JSON.stringify({ u: flow.updatedAt, i: flow.flowId }), "utf8").toString(
    "base64",
  );
}

function decodeCursor(cursor: string): CursorBookmark | null {
  try {
    const obj: unknown = JSON.parse(Buffer.from(String(cursor), "base64").toString("utf8"));
    if (
      obj &&
      typeof obj === "object" &&
      typeof (obj as CursorBookmark).u === "string" &&
      typeof (obj as CursorBookmark).i === "string"
    ) {
      return obj as CursorBookmark;
    }
  } catch {}
  return null;
}

function orderAsc(
  a: { updatedAt: string; flowId: string },
  b: { updatedAt: string; flowId: string },
): number {
  return a.updatedAt === b.updatedAt
    ? a.flowId.localeCompare(b.flowId)
    : a.updatedAt.localeCompare(b.updatedAt);
}

function searchSpec({ where = {}, limit, cursor }: SearchParams = {}): SearchSpecResult {
  const {
    updatedAfter,
    updatedBefore,
    processingRule,
    flowType,
    flowDirection,
    trackingId,
    ackStatus,
  } = where;

  let results = [...flows.values()];
  if (updatedAfter) {
    results = results.filter((f) => f.updatedAt > new Date(updatedAfter).toISOString());
  }
  if (updatedBefore) {
    results = results.filter((f) => f.updatedAt <= new Date(updatedBefore).toISOString());
  }
  if (Array.isArray(processingRule) && processingRule.length) {
    results = results.filter((f) => processingRule.includes(f.processingRule));
  }
  if (Array.isArray(flowType) && flowType.length) {
    results = results.filter((f) => flowType.includes(f.flowType));
  }
  if (Array.isArray(flowDirection) && flowDirection.length) {
    results = results.filter((f) => flowDirection.includes(f.flowDirection));
  }
  if (trackingId) {
    results = results.filter((f) => f.trackingId === trackingId);
  }
  if (ackStatus) {
    results = results.filter((f) => f.acknowledgement && f.acknowledgement.status === ackStatus);
  }

  results.sort(orderAsc);

  if (cursor) {
    const bm = decodeCursor(cursor);
    if (bm) {
      const marker = { updatedAt: bm.u, flowId: bm.i };
      results = results.filter((f) => orderAsc(f, marker) > 0);
    }
  }

  const lim = Math.max(1, Math.min(parseInt(String(limit), 10) || 25, 100));
  const page = results.slice(0, lim);
  const hasMore = results.length > lim;

  const body: SearchSpecResult = {
    limit: lim,
    filters: where,
    results: page.map(toFlow),
  };
  if (hasMore && page.length) {
    body.nextCursor = encodeCursor(page[page.length - 1]);
  }
  return body;
}

function searchInternal(criteria: InternalSearchCriteria = {}): InternalSearchResult {
  const {
    flowType,
    flowDirection,
    flowSyntax,
    trackingId,
    invoiceNumber,
    fromDate,
    toDate,
    limit = 50,
    offset = 0,
  } = criteria;

  const asArray = <T>(v: T | T[] | null | undefined): T[] | null =>
    v == null ? null : Array.isArray(v) ? v : [v];
  const types = asArray(flowType);
  const dirs = asArray(flowDirection);
  const syntaxes = asArray(flowSyntax);

  let results = [...flows.values()];
  if (types) {
    results = results.filter((f) => types.includes(f.flowType));
  }
  if (dirs) {
    results = results.filter((f) => dirs.includes(f.flowDirection));
  }
  if (syntaxes) {
    results = results.filter((f) => syntaxes.includes(f.flowSyntax));
  }
  if (trackingId) {
    results = results.filter((f) => f.trackingId === trackingId);
  }
  if (invoiceNumber) {
    results = results.filter((f) => f.invoiceNumber === invoiceNumber);
  }
  if (fromDate) {
    results = results.filter((f) => f.updatedAt >= new Date(fromDate).toISOString());
  }
  if (toDate) {
    results = results.filter((f) => f.updatedAt <= new Date(toDate).toISOString());
  }

  results.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  const total = results.length;
  const lim = Math.max(1, Math.min(parseInt(String(limit), 10) || 50, 500));
  const off = Math.max(0, parseInt(String(offset), 10) || 0);
  const page = results.slice(off, off + lim);

  return { total, limit: lim, offset: off, flows: page.map(toSummary) };
}

function resetStore(): void {
  flows.clear();
  totalBytes = 0;
}

function count(): number {
  return flows.size;
}

export {
  createFlow,
  getFlow,
  updateFlowStatus,
  toFlow,
  toFullFlowInfo,
  toSummary,
  searchSpec,
  searchInternal,
  subscribe,
  resetStore,
  count,
};
