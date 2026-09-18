// Ghost Lyrics: replaces Spotify's lyrics page. Spotify's own lyrics button keeps
// working — it navigates to /lyrics (route in xpui-modules.js); when that route is
// active we mount our view over .Root__main-view and hide Spotify's underneath.
// Also sets up the now-playing card and takes over Spotify's lyrics/fullscreen
// buttons (buttons.ts).

import { mount } from "../react";
import { getSettings, subscribe } from "../settings/store";
import { initPlayerButtons } from "./buttons";
import { LyricsPage } from "./LyricsPage";
import { initLyricsCard } from "./npvCard";

const ROUTE = "/lyrics";

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

export function initLyrics() {
  initLyricsPage();
  initLyricsCard();
  initPlayerButtons();
}
