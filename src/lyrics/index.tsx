// Ghost Lyrics: replaces Spotify's lyrics page. Spotify's own lyrics button keeps
// working — it navigates to /lyrics (route in xpui-modules.js); when that route is
// active we mount our view over .Root__main-view and hide Spotify's underneath.
// Also sets up the now-playing card and the fullscreen button in the player bar.

import { mount } from "../react";
import { getSettings, subscribe } from "../settings/store";
import { openFullscreen } from "./fullscreen";
import { LyricsPage } from "./LyricsPage";
import { initLyricsCard } from "./npvCard";

const ROUTE = "/lyrics";

const FULLSCREEN_ICON = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M1.5 1h4v1.5H3.56l3 3-1.06 1.06-3-3V5.5H1V1.5A.5.5 0 0 1 1.5 1Zm13 0a.5.5 0 0 1 .5.5v4h-1.5V3.56l-3 3-1.06-1.06 3-3H10.5V1h4ZM2.5 12.44l3-3 1.06 1.06-3 3H5.5V15h-4a.5.5 0 0 1-.5-.5v-4h1.5v1.94Zm12.5-1.94v4a.5.5 0 0 1-.5.5h-4v-1.5h1.94l-3-3 1.06-1.06 3 3V10.5H15Z"/></svg>`;

function initLyricsPage() {
  const history = (Spicetify.Platform as any).History;
  let unmount: (() => void) | null = null;
  let host: HTMLElement | null = null;

  const close = () => {
    unmount?.();
    host?.remove();
    unmount = null;
    host = null;
    document.documentElement.classList.remove("ghost-lyrics-open");
  };

  const sync = () => {
    const wanted = getSettings().lyricsPage && history.location.pathname === ROUTE;
    const mainView = document.querySelector<HTMLElement>(".Root__main-view");

    // Re-mount if Spotify re-rendered the main view and dropped our host.
    if (host && !host.isConnected) close();

    if (wanted && !unmount && mainView) {
      host = document.createElement("div");
      host.id = "ghost-lyrics-host";
      mainView.append(host);
      unmount = mount(<LyricsPage />, host);
      document.documentElement.classList.add("ghost-lyrics-open");
    } else if (!wanted && unmount) {
      close();
    }
  };

  history.listen(sync);
  subscribe(sync);
  sync();
}

function initFullscreenButton() {
  const button = new Spicetify.Playbar.Button("Ghost fullscreen", FULLSCREEN_ICON, () => openFullscreen(), false, false, false);
  let registered = false;
  const sync = () => {
    const wanted = getSettings().lyricsPage && getSettings().fullscreenButton;
    if (wanted && !registered) button.register();
    if (!wanted && registered) button.deregister();
    registered = wanted;
  };
  subscribe(sync);
  sync();
}

export function initLyrics() {
  initLyricsPage();
  initLyricsCard();
  initFullscreenButton();
}
