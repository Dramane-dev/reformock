import { $ } from "./dom.js";
import { state, authHeaders } from "./state.js";
import { connect } from "./auth.js";
import { receipt } from "./receipt.js";
import { refresh } from "./registry.js";

async function uploadFiles(fileList) {
  const files = [...fileList];
  if (!files.length) {
    return;
  }
  if (!state.AUTH_DISABLED && !state.TOKEN) {
    const ok = await connect(true);
    if (!ok) {
      receipt(
        files[0].name + (files.length > 1 ? " (+" + (files.length - 1) + ")" : ""),
        "Connectez-vous d’abord (compte API).",
        "refusé",
        true,
      );
      return;
    }
  }
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  fd.append("flowDirection", $("direction").value);
  if ($("flowType").value) {
    fd.append("flowType", $("flowType").value);
  }
  if ($("trackingId").value.trim()) {
    fd.append("trackingId", $("trackingId").value.trim());
  }

  try {
    const r = await fetch(state.API + "/admin/inject", {
      method: "POST",
      headers: authHeaders(),
      body: fd,
    });
    const data = await r.json();
    if (!r.ok) {
      throw new Error(data.message || r.status);
    }
    data.flows.forEach((fl) => {
      receipt(
        fl.metadata.receivedFilename || fl.invoiceNumber || fl.flowId,
        (fl.invoiceNumber ? "N° " + fl.invoiceNumber + " · " : "") +
          fl.flowType +
          " · " +
          fl.flowSyntax +
          " · flowId " +
          fl.flowId.slice(0, 8) +
          "…",
        "reçu",
        false,
      );
    });
    refresh();
  } catch (e) {
    receipt(files.map((f) => f.name).join(", "), "Échec du dépôt : " + e.message, "refusé", true);
  }
}

export function initUpload() {
  const dz = $("dropzone");
  dz.addEventListener("click", () => $("fileInput").click());
  dz.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      $("fileInput").click();
    }
  });
  ["dragover", "dragenter"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add("over");
    }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove("over");
    }),
  );
  dz.addEventListener("drop", (e) => uploadFiles(e.dataTransfer.files));
  $("fileInput").addEventListener("change", (e) => {
    uploadFiles(e.target.files);
    e.target.value = "";
  });
}
