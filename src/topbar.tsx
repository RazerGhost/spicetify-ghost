// Settings button in the top bar, styled exactly like custom-app links (e.g. the
// Marketplace cart): Spotify's own ButtonTertiary with the classes Spicetify uses
// for custom-app nav links (see _renderNavLinks in spicetifyWrapper.js).
//
// We place it ourselves instead of using Spicetify.Topbar.Button: that waits for
// .main-globalNav-historyButtons, which Spotify 1.3.5 no longer renders (Spicetify
// 2.46.1), so its buttons never reach the page. Ours goes after the ◀ ▶ arrows,
// before the custom-app links, and is put back if Spotify re-renders the bar.

import { Icon, iconMarkup } from "./icons";
import { mount } from "./react";
import { onDomChange } from "./watch";

const GhostIcon = () => <Icon name="ghost" size={24} />;

/** The ◀ ▶ group: its 1.3.3 name, or the wrapper 1.3.5 renders instead. */
const HISTORY = ".main-globalNav-historyButtons, .main-globalNav-historyButtonsWrapper";
const CUSTOM_LINKS = ".custom-navlinks-scrollable_container";

export function addTopbarButton(label: string, onClick: () => void) {
  const element = document.createElement("div");
  element.className = "ghost-topbar-button";
  element.style.display = "contents";

  const ButtonTertiary = Spicetify.ReactComponent?.ButtonTertiary;
  if (ButtonTertiary) {
    mount(
      <ButtonTertiary
        iconOnly={GhostIcon}
        aria-label={label}
        className="link-subtle main-globalNav-navLink main-globalNav-link-icon custom-navlink"
        onClick={onClick}
      />,
      element,
    );
  } else {
    // Fallback: a plain button with our icon, sized by the top-bar CSS.
    const button = document.createElement("button");
    button.className = "main-globalNav-link-icon";
    button.setAttribute("aria-label", label);
    button.innerHTML = iconMarkup("ghost", 24);
    button.onclick = onClick;
    element.append(button);
  }

  const place = () => {
    const group = document.querySelector(HISTORY);
    if (!group) return;
    const links = group.querySelector(`:scope > ${CUSTOM_LINKS}`);
    if (links) {
      if (element.nextElementSibling !== links) group.insertBefore(element, links);
    } else if (element.parentElement !== group) {
      group.append(element);
    }
  };
  place();
  onDomChange(place);
}
