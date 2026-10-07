// Mirrors "right sidebar is collapsed" onto <html> as .ghost-sidebar-collapsed,
// for the "Hide collapsed right sidebar" setting. This used to be a CSS :has()
// on .Root__top-container, which made Chromium search the whole app on every
// restyle of the main view (page changes, settings changes) — even with the
// setting off. Collapsed = .Root__right-sidebar-peek without -expanded
// (classes from xpui-modules.js).
//
// Spotify 1.3.3 hashes those classes and Spicetify 2.45.3 doesn't map them. There
// the sidebar is the grid item right after #main-view (always rendered), its first
// child the peek, and the peek's content is aria-hidden="true" while collapsed.

import { onDomChange } from "./watch";

const SIDEBAR = ".Root__right-sidebar, #main-view + div";

let observed: Element | null = null;
const classObserver = new MutationObserver(update);

function isCollapsed(sidebar: Element | null): boolean {
  const peek = sidebar?.querySelector(".Root__right-sidebar-peek");
  if (peek) return !peek.classList.contains("Root__right-sidebar-expanded");
  return sidebar?.firstElementChild?.querySelector("[aria-hidden]")?.getAttribute("aria-hidden") === "true";
}

function update() {
  const collapsed = isCollapsed(document.querySelector(SIDEBAR));
  document.documentElement.classList.toggle("ghost-sidebar-collapsed", collapsed);
}

// Collapsing/expanding changes attributes (not nodes), so watch class and
// aria-hidden — but only inside the sidebar, and re-attach if Spotify replaces it.
function attach() {
  const sidebar = document.querySelector(SIDEBAR);
  if (sidebar === observed) return;
  classObserver.disconnect();
  observed = sidebar;
  if (sidebar) classObserver.observe(sidebar, { attributes: true, attributeFilter: ["class", "aria-hidden"], subtree: true });
}

export function initSidebarState() {
  const sync = () => {
    attach();
    update();
  };
  onDomChange(sync);
  sync();
}
