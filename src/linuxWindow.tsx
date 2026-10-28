// Linux: window buttons at the right end of the top bar, for window managers that
// draw no title bar (Hyprland and other tiling or "bare" compositors), where
// Spotify otherwise has no way to be closed or minimised with the mouse.
// Setting "linuxWindowButtons": close (default), both, or off (desktops that draw
// their own title bar, like GNOME or KDE, don't need them).
//
// They use Spotify's desktop window service (FocusMainWindowAPI._windowStateClient):
// closeWindow follows Spotify's own close setting; setWindowState({ state: 3 })
// asks the window manager to minimise. Hyprland ignores an app's own minimise
// request (only taskbar-style clients can minimise there), so the default is
// close only. Moving can't be done from here: Spotify on Linux leaves that to the
// window manager's title bar (it ignores -webkit-app-region), so on Hyprland the
// window moves with its mouse bind (e.g. Super + drag).

import { Icon } from "./icons";
import { isLinux, platform } from "./platform";
import { mount } from "./react";
import { getSettings, watchSettings } from "./settings/store";
import { onDomChange } from "./watch";

const MINIMIZED = 3;

const MinimizeIcon = () => <Icon name="minimize" size={16} />;
const CloseIcon = () => <Icon name="close" size={16} />;

function WindowButtons({ minimize }: { minimize: boolean }) {
  const ButtonTertiary = Spicetify.ReactComponent?.ButtonTertiary;
  const windows = () => platform().FocusMainWindowAPI?._windowStateClient;
  const className = "link-subtle main-globalNav-navLink main-globalNav-link-icon ghost-window-button";
  if (!ButtonTertiary) return null;
  return (
    <>
      {minimize && (
        <ButtonTertiary
          iconOnly={MinimizeIcon}
          aria-label="Minimise"
          className={className}
          onClick={() => windows()?.setWindowState?.({ state: MINIMIZED }).catch(() => {})}
        />
      )}
      <ButtonTertiary
        iconOnly={CloseIcon}
        aria-label="Close"
        className={className}
        onClick={() => windows()?.closeWindow?.({}).catch(() => {})}
      />
    </>
  );
}

export function initLinuxWindowButtons() {
  if (!isLinux) return;

  const element = document.createElement("div");
  element.className = "ghost-window-buttons"; // flex + no-drag: 40-top-bar.css
  let unmount: (() => void) | null = null;

  const render = () => {
    unmount?.();
    unmount = null;
    const mode = getSettings().linuxWindowButtons;
    if (mode === "off") {
      element.remove();
      return;
    }
    unmount = mount(<WindowButtons minimize={mode === "both"} />, element);
    place();
  };

  // The right-hand group (friends, notifications, avatar); ours go after it.
  const place = () => {
    if (getSettings().linuxWindowButtons === "off") return;
    const right = document.querySelector(".main-globalNav-contentRight");
    if (right && element.parentElement !== right) right.append(element);
  };

  watchSettings((s) => [s.linuxWindowButtons], render);
  onDomChange(place);
  render();
}
