import { generateInvoiceData, pick, randInt } from "../generators/data.ts";
import { generateUBL } from "../generators/ubl.ts";
import { generateCII } from "../generators/cii.ts";
import { generateCDAR, LIFECYCLE_STATUSES, HAPPY_PATH } from "../generators/cdar.ts";
import { generateReadablePDF } from "../generators/pdf.ts";
import { config } from "../config.ts";
import * as store from "./store.ts";

import type { Flow, FlowSyntax, LifecycleStatus } from "../types.ts";

interface CreateLifecycleFlowParams {
  flowType: string;
  invoiceNumber: string;
  sellerSiret: string;
  buyerSiret: string;
  status: { code: string; name: string };
  comment?: string | null;
}

interface ScheduleLifecycleParams {
  flowId: string;
  invoiceNumber: string;
  sellerSiret?: string;
  buyerSiret?: string;
}

async function createIncomingInvoiceFlow(): Promise<Flow> {
  const inv = generateInvoiceData();
  const syntax = pick<FlowSyntax>(["UBL", "CII", "CII"]);
  const originalXml = syntax === "UBL" ? generateUBL(inv) : generateCII(inv);
  const convertedXml = syntax === "UBL" ? generateCII(inv) : generateUBL(inv);
  const pdf = await generateReadablePDF(inv);

  const flow = store.createFlow({
    flowType: "SupplierInvoice",
    flowDirection: "In",
    flowSyntax: syntax,
    invoiceNumber: inv.invoiceNumber,
    metadata: {
      seller: {
        name: inv.seller.name,
        siren: inv.seller.siren,
        siret: inv.seller.siret,
        vatNumber: inv.seller.vatNumber,
      },
      buyer: {
        name: inv.buyer.name,
        siren: inv.buyer.siren,
        siret: inv.buyer.siret,
        vatNumber: inv.buyer.vatNumber,
      },
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      currency: inv.currency,
      totalExclVat: inv.totals.totalHT,
      totalVat: inv.totals.totalVAT,
      totalInclVat: inv.totals.totalTTC,
    },
    documents: {
      Original: {
        content: Buffer.from(originalXml, "utf8"),
        contentType: "application/xml",
        filename: `${inv.invoiceNumber}_${syntax.toLowerCase()}.xml`,
      },
      ReadableView: {
        content: pdf,
        contentType: "application/pdf",
        filename: `${inv.invoiceNumber}.pdf`,
      },
      Converted: {
        content: Buffer.from(convertedXml, "utf8"),
        contentType: "application/xml",
        filename: `${inv.invoiceNumber}_${syntax === "UBL" ? "cii" : "ubl"}.xml`,
      },
    },
  });

  createLifecycleFlow({
    flowType: "SupplierInvoiceLC",
    invoiceNumber: inv.invoiceNumber,
    sellerSiret: inv.seller.siret,
    buyerSiret: inv.buyer.siret,
    status: { code: "204", name: "Mise à disposition" },
  });

  return flow;
}

function createLifecycleFlow({
  flowType,
  invoiceNumber,
  sellerSiret,
  buyerSiret,
  status,
  comment,
}: CreateLifecycleFlowParams): Flow {
  const xml = generateCDAR({
    invoiceNumber,
    statusCode: status.code,
    statusName: status.name,
    sellerSiret,
    buyerSiret,
    comment,
  });
  return store.createFlow({
    flowType,
    flowDirection: "In",
    flowSyntax: "CDAR",
    invoiceNumber,
    statusCode: status.code,
    statusName: status.name,
    metadata: { relatedInvoice: invoiceNumber },
    documents: {
      Original: {
        content: Buffer.from(xml, "utf8"),
        contentType: "application/xml",
        filename: `LC_${invoiceNumber}_${status.code}.xml`,
      },
    },
  });
}

function scheduleLifecycleForDepositedInvoice({
  flowId,
  invoiceNumber,
  sellerSiret = "00000000000000",
  buyerSiret = "11111111111111",
}: ScheduleLifecycleParams): void {
  const delay = config.simulator.lifecycleDelaySeconds * 1000;
  const statuses = HAPPY_PATH.map((c) => LIFECYCLE_STATUSES.find((s) => s.code === c)).filter(
    (s): s is LifecycleStatus => s !== undefined,
  );
  statuses.forEach((status, i) => {
    setTimeout(
      () => {
        const invoiceFlow = flowId ? store.getFlow(flowId) : null;
        if (invoiceFlow && ["201", "208", "210"].includes(invoiceFlow.statusCode ?? "")) {
          return;
        }
        createLifecycleFlow({
          flowType: "CustomerInvoiceLC",
          invoiceNumber,
          sellerSiret,
          buyerSiret,
          status,
        });
        if (invoiceFlow) {
          store.updateFlowStatus(flowId, { statusCode: status.code, statusName: status.name });
        }
        console.log(
          `[simulateur] Cycle de vie ${status.code} "${status.name}" généré pour ${invoiceNumber}`,
        );
      },
      delay * (i + 1),
    ).unref();
  });
}

async function seed(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await createIncomingInvoiceFlow();
  }
  console.log(
    `[simulateur] ${count} facture(s) fournisseur entrante(s) générée(s) (total flux : ${store.count()})`,
  );
}

function startPeriodicGeneration(): void {
  const interval = config.simulator.generationIntervalSeconds;
  if (!interval || interval <= 0) {
    console.log("[simulateur] Génération périodique désactivée (GENERATION_INTERVAL_SECONDS=0)");
    return;
  }
  setInterval(async () => {
    const n = randInt(1, 3);
    await seed(n);
  }, interval * 1000).unref();
  console.log(`[simulateur] Génération périodique : 1 à 3 factures toutes les ${interval}s`);
}

export {
  createIncomingInvoiceFlow,
  createLifecycleFlow,
  scheduleLifecycleForDepositedInvoice,
  seed,
  startPeriodicGeneration,
};
