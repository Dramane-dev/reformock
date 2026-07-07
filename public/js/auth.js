import { $ } from "./dom.js";
import { state } from "./state.js";

export function setAuthState(msg, ok) {
  const el = $("authState");
  el.textContent = msg;
  el.className = ok ? "ok" : "ko";
}

export async function connect(silent) {
  try {
    const r = await fetch("/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: $("clientId").value.trim(),
        client_secret: $("clientSecret").value.trim(),
      }),
    });
    if (!r.ok) {
      throw new Error("identifiants refusés (" + r.status + ")");
    }
    const data = await r.json();
    state.TOKEN = data.access_token;
    setAuthState("jeton actif, expire dans " + data.expires_in + " s", true);
    return true;
  } catch (e) {
    state.TOKEN = null;
    if (!silent) {
      setAuthState("échec : " + e.message, false);
    } else {
      setAuthState("non connecté, vérifiez les identifiants puis « Obtenir un jeton »", false);
    }
    return false;
  }
}
