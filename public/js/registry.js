import { $ } from "./dom.js";
import { state, PAGE_SIZE, authHeaders } from "./state.js";
import { receipt } from "./receipt.js";

export async function loadStatuses() {
  try {
    const r = await fetch(state.API + "/admin/lifecycle-statuses", { headers: authHeaders() });
    if (r.ok) {
      state.STATUSES = (await r.json()).statuses || [];
    }
  } catch {}
}

export async function refresh(resetPage) {
  const body = { limit: 500, offset: 0 };
  if ($("fType").value) {
    body.flowType = [$("fType").value];
  }
  if ($("fDir").value) {
    body.flowDirection = [$("fDir").value];
  }
  let data;
  try {
    const r = await fetch(state.API + "/admin/flows/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (r.status === 401) {
      $("count").textContent = "authentification requise";
      return;
    }
    data = await r.json();
    if (data.total > data.flows.length) {
      const r2 = await fetch(state.API + "/admin/flows/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...body, offset: Math.max(0, data.total - body.limit) }),
      });
      if (r2.ok) {
        data = await r2.json();
      }
    }
  } catch {
    $("count").textContent = "erreur réseau";
    return;
  }

  state.TOTAL = data.total;
  state.ALL = [...data.flows].reverse();
  const pages = Math.max(1, Math.ceil(state.ALL.length / PAGE_SIZE));
  if (resetPage) {
    state.PAGE = 0;
  }
  state.PAGE = Math.min(Math.max(0, state.PAGE), pages - 1);
  renderPage();
}

function goPage(p) {
  const pages = Math.max(1, Math.ceil(state.ALL.length / PAGE_SIZE));
  state.PAGE = Math.min(Math.max(0, p), pages - 1);
  renderPage();
  const tw = document.querySelector(".table-wrap");
  if (tw) {
    tw.scrollTop = 0;
  }
}

function renderPage() {
  const rows = $("rows");
  rows.innerHTML = "";
  const pages = Math.max(1, Math.ceil(state.ALL.length / PAGE_SIZE));
  const start = state.PAGE * PAGE_SIZE;
  const flows = state.ALL.slice(start, start + PAGE_SIZE);
  $("empty").hidden = state.ALL.length > 0;

  if (state.ALL.length) {
    const totalTxt =
      state.TOTAL > state.ALL.length
        ? state.ALL.length + " sur " + state.TOTAL
        : String(state.TOTAL);
    $("count").textContent =
      start + 1 + "–" + (start + flows.length) + " sur " + totalTxt + " flux";
  } else {
    $("count").textContent = "0 flux";
  }
  $("pageInfo").textContent = "Page " + (state.PAGE + 1) + " / " + pages;
  $("pgFirst").disabled = $("pgPrev").disabled = state.PAGE <= 0;
  $("pgLast").disabled = $("pgNext").disabled = state.PAGE >= pages - 1;

  for (const f of flows) {
    const tr = document.createElement("tr");
    tr.className = f.flowDirection === "In" ? "row-in" : "row-out";
    const seller = f.metadata && f.metadata.seller ? f.metadata.seller.name : null;
    const buyer = f.metadata && f.metadata.buyer ? f.metadata.buyer.name : null;
    const total =
      f.metadata && f.metadata.totalInclVat != null
        ? f.metadata.totalInclVat.toFixed(2) + " " + (f.metadata.currency || "EUR")
        : "";
    const injected = f.metadata && f.metadata.injectedVia === "web-console";

    tr.innerHTML =
      '<td><div class="mono"></div><div style="color:var(--gray);font-size:11.5px"></div></td>' +
      '<td><span class="tag type"></span> <span class="tag dirtag"></span>' +
      (injected ? ' <span class="tag web">web</span>' : "") +
      "</td>" +
      '<td class="mono syn"></td>' +
      '<td class="statuscell"></td>' +
      '<td class="parties" style="max-width:210px"></td>' +
      '<td class="amount mono"></td>' +
      '<td class="mono date"></td>' +
      '<td class="docs"></td>';

    tr.querySelector(".mono").textContent = f.invoiceNumber || "-";
    tr.children[0].children[1].textContent = "flowId " + f.flowId.slice(0, 8) + "…";
    const tType = tr.querySelector(".type");
    tType.textContent = f.flowType;
    const tDir = tr.querySelector(".dirtag");
    tDir.textContent = f.flowDirection;
    tDir.classList.add(f.flowDirection === "In" ? "in" : "out");
    tr.querySelector(".syn").textContent = f.flowSyntax;

    const sc = tr.querySelector(".statuscell");
    const isInvoice = f.flowSyntax !== "CDAR" && !f.flowType.endsWith("LC");
    if (isInvoice && state.STATUSES.length) {
      const sel = document.createElement("select");
      sel.className = "statusselect";
      sel.setAttribute("aria-label", "Changer le statut de " + (f.invoiceNumber || f.flowId));
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = f.statusName ? f.statusCode + " · " + f.statusName : "(sans statut)";
      sel.appendChild(opt0);
      state.STATUSES.filter((s) => s.code !== f.statusCode).forEach((s) => {
        const o = document.createElement("option");
        o.value = s.code;
        o.textContent = s.code + " · " + s.name;
        sel.appendChild(o);
      });
      sel.addEventListener("change", () => changeStatus(f, sel));
      sc.appendChild(sel);
    } else {
      sc.innerHTML = '<span class="mono" style="font-size:12px"></span>';
      sc.firstChild.textContent = f.statusName ? f.statusCode + " " + f.statusName : "-";
    }
    tr.querySelector(".parties").textContent =
      seller || buyer ? (seller || "?") + " → " + (buyer || "?") : "";
    tr.querySelector(".amount").textContent = total;
    tr.querySelector(".date").textContent = new Date(f.createdDate).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "medium",
    });

    const docs = tr.querySelector(".docs");
    (f.availableDocTypes || []).forEach((dt) => {
      const b = document.createElement("button");
      b.className = "dl";
      b.textContent = dt === "Original" ? "XML" : dt === "ReadableView" ? "PDF" : "Conversion";
      b.addEventListener("click", () => download(f, dt));
      docs.appendChild(b);
    });
    rows.appendChild(tr);
  }
}

async function changeStatus(flow, sel) {
  const code = sel.value;
  if (!code) {
    return;
  }
  const status = state.STATUSES.find((s) => s.code === code);
  let comment = null;
  if (status && status.requiresReason) {
    comment = prompt("Motif pour « " + status.name + " » (ajouté au statut CDAR) :", "");
    if (comment === null) {
      sel.value = "";
      return;
    }
  }
  try {
    const r = await fetch(state.API + "/admin/flows/" + flow.flowId + "/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        statusCode: code,
        statusName: status ? status.name : undefined,
        comment: comment || undefined,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      throw new Error(data.message || r.status);
    }
    receipt(
      flow.invoiceNumber || flow.flowId,
      "Statut changé : " +
        code +
        " " +
        (status ? status.name : "") +
        (data.lifecycleFlow
          ? " · flux CDAR " + data.lifecycleFlow.flowId.slice(0, 8) + "… émis"
          : ""),
      status && status.requiresReason ? "refusé" : "statut",
      status && status.requiresReason,
    );
    refresh();
  } catch (e) {
    alert("Changement de statut impossible : " + e.message);
    sel.value = "";
  }
}

async function download(flow, docType) {
  try {
    const r = await fetch(state.API + "/flows/" + flow.flowId + "?docType=" + docType, {
      headers: authHeaders(),
    });
    if (!r.ok) {
      throw new Error(r.status);
    }
    const blob = await r.blob();
    const cd = r.headers.get("Content-Disposition") || "";
    const m = cd.match(/filename="([^"]+)"/);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = m
      ? m[1]
      : (flow.invoiceNumber || flow.flowId) + (docType === "ReadableView" ? ".pdf" : ".xml");
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    alert("Téléchargement impossible (" + e.message + ")");
  }
}

export function initRegistry() {
  $("btnRefresh").addEventListener("click", () => refresh(true));
  $("fType").addEventListener("change", () => refresh(true));
  $("fDir").addEventListener("change", () => refresh(true));
  $("pgFirst").addEventListener("click", () => goPage(0));
  $("pgPrev").addEventListener("click", () => goPage(state.PAGE - 1));
  $("pgNext").addEventListener("click", () => goPage(state.PAGE + 1));
  $("pgLast").addEventListener("click", () => goPage(Math.ceil(state.ALL.length / PAGE_SIZE) - 1));
  $("btnReset").addEventListener("click", async () => {
    if (!confirm("Vider le registre ? Tous les flux (générés et déposés) seront supprimés.")) {
      return;
    }
    await fetch(state.API + "/admin/reset", { method: "POST", headers: authHeaders() });
    refresh();
  });
}
