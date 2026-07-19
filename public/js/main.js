import { $ } from "./dom.js";
import { state } from "./state.js";
import { connect, setAuthState } from "./auth.js";
import { refresh, loadStatuses, initRegistry } from "./registry.js";
import { initUpload } from "./upload.js";
import { initTabs } from "./tabs.js";

async function init() {
  const cfg = window.__REFORMOCK_CONFIG__ || {};
  state.API = cfg.apiPrefix || "/v1";
  state.AUTH_DISABLED = !!cfg.authDisabled;
  if (state.AUTH_DISABLED) {
    $("authCard").style.display = "none";
    setAuthState("authentification désactivée sur ce serveur", true);
  }
  healthcheck();
  setInterval(healthcheck, 30000);
  if (!state.AUTH_DISABLED && $("clientId").value.trim()) {
    await connect(true).then(async (ok) => {
      if (ok) {
        await loadStatuses();
        refresh();
      }
    });
  }
}

async function healthcheck() {
  try {
    const r = await fetch(state.API + "/healthcheck");
    const ok = r.ok;
    $("hcDot").className = "dot " + (ok ? "up" : "down");
    $("hcText").textContent = ok ? "service opérationnel" : "service indisponible";
  } catch {
    $("hcDot").className = "dot down";
    $("hcText").textContent = "service injoignable";
  }
}

$("btnConnect").addEventListener("click", () =>
  connect(false).then(async (ok) => {
    if (ok) {
      await loadStatuses();
      refresh();
    }
  }),
);
initRegistry();
initUpload();
initTabs();

init();
