// Take over two of Spotify's own player-bar buttons (dwp-now-playing-bar.js):
//   - lyrics-button: Spotify renders it with isActive hard-coded to false, so it
//     only ever navigates *to* /lyrics. On the lyrics page, make it go back.
//   - fullscreen-mode-button: open Ghost's fullscreen instead of Spotify's cinema
//     mode (setting "replaceFullscreen").
// A capture-phase listener on document runs before React's handlers (which sit
// on the app root), so stopping it there means Spotify never sees the click.

import { getSettings } from "../settings/store";
import { openFullscreen } from "./fullscreen";

export function initPlayerButtons() {
  const history = (Spicetify.Platform as any).History;

  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element | null;
      const s = getSettings();
      if (!target?.closest || !s.lyricsPage) return;

      if (target.closest('[data-testid="lyrics-button"]') && history.location.pathname === "/lyrics") {
        e.preventDefault();
        e.stopPropagation();
        history.goBack();
        return;
      }

      if (target.closest('[data-testid="fullscreen-mode-button"]') && s.replaceFullscreen) {
        e.preventDefault();
        e.stopPropagation();
        openFullscreen();
      }
    },
    true,
  );
}
