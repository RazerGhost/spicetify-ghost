// Clicking the canvas (looping video) in the now-playing view toggles an enlarged
// canvas — onClick on .main-nowPlayingView-coverArtContainer in
// dwp-panel-section.js (on Spotify 1.3.3 a hashed class: the parent of
// [data-testid=track-visual-enhancement]). Spotify animates the rest of the panel down by changing
// its layout every frame, which stutters (disabling Ghost's parts one by one
// didn't help, so it's Spotify's own animation). Setting "canvasExpand" off (the
// default) swallows that click. Buttons/links inside the area still work.

import { interceptClick } from "./intercept";
import { getSettings } from "./settings/store";

export function initCanvasClick() {
  interceptClick(".main-nowPlayingView-coverArtContainer, :has(> [data-testid='track-visual-enhancement'])", (target) => {
    if (getSettings().canvasExpand) return false;
    return !target.closest("button, a, [role='button']");
  });
}
