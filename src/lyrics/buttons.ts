// Take over two of Spotify's own player-bar buttons (dwp-now-playing-bar.js):
//   - lyrics-button: Spotify renders it with isActive hard-coded to false, so it
//     only ever navigates *to* /lyrics. On the lyrics page, make it go back.
//   - fullscreen-mode-button: open Ghost's fullscreen instead of Spotify's cinema
//     mode (setting "replaceFullscreen").
// Spotify disables the lyrics button for songs it has no lyrics for, but Ghost
// finds lyrics for more (LRCLIB, AMLL). A disabled button gets no click event,
// only pointer events, so there pointerup opens Ghost's lyrics page (or goes back
// from it); 60-lyrics.css makes it look clickable.

import { interceptClick } from "../intercept";
import { history } from "../platform";
import { getSettings } from "../settings/store";
import { openFullscreen } from "./fullscreen";
import { LYRICS_ROUTE, onLyricsRoute } from "./route";

export function initPlayerButtons() {
  interceptClick('[data-testid="lyrics-button"]', () => {
    if (!getSettings().lyricsPage || !onLyricsRoute()) return false;
    history().goBack();
    return true;
  });

  document.addEventListener(
    "pointerup",
    (e) => {
      if (e.button !== 0 || !getSettings().lyricsPage) return;
      const button = (e.target as Element | null)?.closest?.<HTMLButtonElement>('[data-testid="lyrics-button"]');
      if (!button?.disabled) return; // enabled: Spotify's click (and the handler above) take it
      if (onLyricsRoute()) history().goBack();
      else history().push(LYRICS_ROUTE);
    },
    true,
  );

  interceptClick('[data-testid="fullscreen-mode-button"]', () => {
    const s = getSettings();
    if (!s.lyricsPage || !s.replaceFullscreen) return false;
    openFullscreen();
    return true;
  });
}
