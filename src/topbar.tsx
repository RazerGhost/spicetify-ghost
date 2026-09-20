// Settings button in the top bar, styled exactly like custom-app links (e.g. the
// Marketplace cart). Spicetify.Topbar.Button copies the ◀ ▶ arrows' class and
// re-applies it on every navigation, so we only use it for placement and render
// Spotify's own ButtonTertiary into its wrapper — the same component and classes
// Spicetify uses for custom-app nav links (see _renderNavLinks in spicetifyWrapper.js).

import { Icon, iconMarkup } from "./icons";
import { mount } from "./react";

const GhostIcon = () => <Icon name="ghost" size={24} />;

export function addTopbarButton(label: string, onClick: () => void) {
  const btn = new Spicetify.Topbar.Button(label, "", onClick) as unknown as {
    element: HTMLElement;
    button: HTMLButtonElement;
  };

  const ButtonTertiary = Spicetify.ReactComponent?.ButtonTertiary;
  if (!ButtonTertiary) {
    // Fallback: plain Spicetify button (arrow styling) with our icon.
    btn.button.innerHTML = iconMarkup("ghost", 24);
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
