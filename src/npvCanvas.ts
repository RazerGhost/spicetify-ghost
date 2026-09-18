// Clicking the canvas (looping video) in the now-playing view toggles an enlarged
// canvas — onClick on .main-nowPlayingView-coverArtContainer in
// dwp-panel-section.js. Spotify animates the rest of the panel down by changing
// its layout every frame, which stutters (disabling Ghost's parts one by one
// didn't help, so it's Spotify's own animation). Setting
// "canvasExpand" off (the default) swallows that click in the capture phase,
// before React's handler. Buttons/links inside the area still work.

import { getSettings } from "./settings/store";

export function initCanvasClick() {
  document.addEventListener(
    "click",
    (e) => {
      if (getSettings().canvasExpand) return;
      const target = e.target as Element | null;
      if (!target?.closest?.(".main-nowPlayingView-coverArtContainer")) return;
      if (target.closest("button, a, [role='button']")) return;
      e.stopPropagation();
    },
    true,
  );
}
