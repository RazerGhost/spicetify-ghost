// Opens / closes the fullscreen view: mounts it on <body> and hides Spotify's UI
// (.Root) so Ghost's background shows through. Setting "fullscreenMode":
//   - "screen": also puts the window in real fullscreen; leaving that closes us.
//   - "window": fills Spotify's window only, at whatever size it has (e.g. half
//     the screen next to another app).
//   - "auto" (default): "screen" when Spotify is maximised, else "window".
// Esc or the ✕ button closes it either way.

import { mountIn } from "../react";
import { getSettings } from "../settings/store";
import { FullscreenView } from "./FullscreenView";

let close: (() => void) | null = null;

/** Spotify's window covers (about) the whole screen — maximised, not snapped. */
function fillsScreen() {
  const slack = 16; // window borders, rounding
  return window.outerWidth >= screen.availWidth - slack && window.outerHeight >= screen.availHeight - slack;
}

function wantsScreen() {
  const mode = getSettings().fullscreenMode;
  return mode === "screen" || (mode === "auto" && fillsScreen());
}

export function openFullscreen() {
  if (close) return;

  document.documentElement.classList.add("ghost-fullscreen");
  const view = mountIn(document.body, "ghost-fs-host", <FullscreenView onClose={closeFullscreen} />);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeFullscreen();
  };
  document.addEventListener("keydown", onKey);

  // Only what we turned on is ours to react to and undo — in window mode the
  // window may already be in fullscreen (F11) and should stay that way.
  let entered = false;
  const onFullscreenChange = () => {
    // Fires on enter and exit; only exiting should close us.
    if (entered && !document.fullscreenElement) closeFullscreen();
  };
  document.addEventListener("fullscreenchange", onFullscreenChange);
  if (wantsScreen() && !document.fullscreenElement) {
    document.documentElement
      .requestFullscreen?.()
      .then(() => (entered = true))
      .catch(() => {
        // Not allowed (e.g. no user gesture): stay as an in-window overlay.
      });
  }

  close = () => {
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    view.dispose();
    document.documentElement.classList.remove("ghost-fullscreen");
    if (entered && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}

export function closeFullscreen() {
  const fn = close;
  close = null;
  fn?.();
}
