import { $ } from "./dom.js";

const TABS = [
  { tab: "tabRegistry", panel: "panelRegistry" },
  { tab: "tabDeposit", panel: "panelDeposit" },
];

function selectTab(tabId) {
  TABS.forEach((t) => {
    const active = t.tab === tabId;
    const btn = $(t.tab);
    btn.setAttribute("aria-selected", active ? "true" : "false");
    btn.tabIndex = active ? 0 : -1;
    $(t.panel).hidden = !active;
  });
}

export function initTabs() {
  TABS.forEach((t, i) => {
    $(t.tab).addEventListener("click", () => selectTab(t.tab));
    $(t.tab).addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") {
        return;
      }
      e.preventDefault();
      const next = TABS[(i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length];
      selectTab(next.tab);
      $(next.tab).focus();
    });
  });
}
