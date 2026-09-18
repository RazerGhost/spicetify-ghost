// Settings button in the top bar, styled exactly like custom-app links (e.g. the
// Marketplace cart). Spicetify.Topbar.Button copies the ◀ ▶ arrows' class and
// re-applies it on every navigation, so we only use it for placement and render
// Spotify's own ButtonTertiary into its wrapper — the same component and classes
// Spicetify uses for custom-app nav links (see _renderNavLinks in spicetifyWrapper.js).

import { mount } from "./react";

const GHOST_PATH =
  "M12 2a8 8 0 0 0-8 8v11.2c0 .6.7 1 1.2.6l1.9-1.5 1.9 1.5c.3.3.8.3 1.1 0L12 20.3l1.9 1.5c.3.3.8.3 1.1 0l1.9-1.5 1.9 1.5c.5.4 1.2 0 1.2-.6V10a8 8 0 0 0-8-8Zm-3 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z";

const GhostIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
    <path d={GHOST_PATH} />
  </svg>
);

export function addTopbarButton(label: string, onClick: () => void) {
  const btn = new Spicetify.Topbar.Button(label, "", onClick) as unknown as {
    element: HTMLElement;
    button: HTMLButtonElement;
  };

  const ButtonTertiary = Spicetify.ReactComponent?.ButtonTertiary;
  if (!ButtonTertiary) {
    // Fallback: plain Spicetify button (arrow styling) with our icon.
    btn.button.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="${GHOST_PATH}"/></svg>`;
    return;
  }

  // Keep Spicetify's <button> (it re-classes the first button in the wrapper on
  // every navigation) but hide it, and render ours next to it.
  btn.button.hidden = true;
  btn.element.classList.add("ghost-topbar-button");
  const host = document.createElement("span");
  host.style.display = "contents";
  btn.element.append(host);

  mount(
    <ButtonTertiary
      iconOnly={GhostIcon}
      aria-label={label}
      className="link-subtle main-globalNav-navLink main-globalNav-link-icon custom-navlink"
      onClick={onClick}
    />,
    host,
  );
}
