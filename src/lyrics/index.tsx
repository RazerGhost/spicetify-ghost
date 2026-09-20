// Ghost Lyrics: replaces Spotify's lyrics page. Spotify's own lyrics button keeps
// working — it navigates to /lyrics (route in xpui-modules.js); when that route is
// active we mount our view over .Root__main-view and hide Spotify's underneath.
// Also sets up the now-playing card and takes over Spotify's lyrics/fullscreen
// buttons (buttons.ts).

import { history } from "../platform";
import { mountIn } from "../react";
import { getSettings, watchSettings } from "../settings/store";
import { onDomChange } from "../watch";
import { initPlayerButtons } from "./buttons";
import { LyricsPage } from "./LyricsPage";
import { initLyricsCard } from "./npvCard";
import { onLyricsRoute } from "./route";

function initLyricsPage() {
  let page: ReturnType<typeof mountIn> | null = null;

  const close = () => {
    page?.dispose();
    page = null;
    document.documentElement.classList.remove("ghost-lyrics-open");
  };

  const sync = () => {
    const wanted = getSettings().lyricsPage && onLyricsRoute();

    // Re-mount if Spotify re-rendered the main view and dropped our host.
    if (page && !page.host.isConnected) close();

    const mainView = wanted && !page ? document.querySelector<HTMLElement>(".Root__main-view") : null;
    if (mainView) {
      page = mountIn(mainView, "ghost-lyrics-host", <LyricsPage />);
      document.documentElement.classList.add("ghost-lyrics-open");
    } else if (!wanted && page) {
      close();
    }
  };

  history().listen(sync);
  watchSettings((s) => s.lyricsPage, sync);
  // Spotify can re-render the main view (dropping our host), or not have it yet
  // when the route changes. Cheap when nothing changed (no DOM query).
  onDomChange(sync);
  sync();
}

export function initLyrics() {
  initLyricsPage();
  initLyricsCard();
  initPlayerButtons();
}
