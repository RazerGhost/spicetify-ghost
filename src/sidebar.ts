// Mirrors "right sidebar is collapsed" onto <html> as .ghost-sidebar-collapsed,
// for the "Hide collapsed right sidebar" setting. This used to be a CSS :has()
// on .Root__top-container, which made Chromium search the whole app on every
// restyle of the main view (page changes, settings changes) — even with the
// setting off. Collapsed = .Root__right-sidebar-peek without -expanded
// (classes from xpui-modules.js).

import { onDomChange } from "./watch";

const SIDEBAR = ".Root__right-sidebar";

let observed: Element | null = null;
const classObserver = new MutationObserver(update);

function update() {
  const peek = document.querySelector(`${SIDEBAR} .Root__right-sidebar-peek`);
  const collapsed = !!peek && !peek.classList.contains("Root__right-sidebar-expanded");
  document.documentElement.classList.toggle("ghost-sidebar-collapsed", collapsed);
}

// Collapsing/expanding changes classes (not nodes), so watch class attributes —
// but only inside the sidebar, and re-attach if Spotify replaces it.
function attach() {
  const sidebar = document.querySelector(SIDEBAR);
  if (sidebar === observed) return;
  classObserver.disconnect();
  observed = sidebar;
  if (sidebar) classObserver.observe(sidebar, { attributes: true, attributeFilter: ["class"], subtree: true });
}

export function initSidebarState() {
  const sync = () => {
    attach();
    update();
  };
  onDomChange(sync);
  sync();
}
