// Opens / closes the fullscreen view: mounts it on <body>, hides Spotify's UI
// (.Root) so Ghost's background shows through, and puts the window in real
// fullscreen. Esc, the ✕ button, or leaving window fullscreen closes it.

import { mount } from "../react";
import { FullscreenView } from "./FullscreenView";

let close: (() => void) | null = null;

export function openFullscreen() {
  if (close) return;

  const host = document.createElement("div");
  host.id = "ghost-fs-host";
  document.body.append(host);
  document.documentElement.classList.add("ghost-fullscreen");
  const unmount = mount(<FullscreenView onClose={closeFullscreen} />, host);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeFullscreen();
  };
  // Fires on enter and exit; only exiting window fullscreen should close us.
  const onFullscreenChange = () => {
    if (!document.fullscreenElement) closeFullscreen();
  };
  document.addEventListener("keydown", onKey);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.documentElement.requestFullscreen?.().catch(() => {
    // Not allowed (e.g. no user gesture): stay as an in-window overlay.
  });

  close = () => {
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    unmount();
    host.remove();
    document.documentElement.classList.remove("ghost-fullscreen");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}

export function closeFullscreen() {
  const fn = close;
  close = null;
  fn?.();
}
