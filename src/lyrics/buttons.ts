// Take over two of Spotify's own player-bar buttons (dwp-now-playing-bar.js):
//   - lyrics-button: Spotify renders it with isActive hard-coded to false, so it
//     only ever navigates *to* /lyrics. On the lyrics page, make it go back.
//   - fullscreen-mode-button: open Ghost's fullscreen instead of Spotify's cinema
//     mode (setting "replaceFullscreen").

import { interceptClick } from "../intercept";
import { history } from "../platform";
import { getSettings } from "../settings/store";
import { openFullscreen } from "./fullscreen";

export function initPlayerButtons() {
  interceptClick('[data-testid="lyrics-button"]', () => {
    if (!getSettings().lyricsPage || history().location.pathname !== "/lyrics") return false;
    history().goBack();
    return true;
  });

  interceptClick('[data-testid="fullscreen-mode-button"]', () => {
    const s = getSettings();
    if (!s.lyricsPage || !s.replaceFullscreen) return false;
    openFullscreen();
    return true;
  });
}
