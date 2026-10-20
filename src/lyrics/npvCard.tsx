// Compact lyrics card in the now-playing view (right sidebar), placed right after
// the cover/canvas and track title (.main-nowPlayingView-nowPlayingWidget inside
// .main-nowPlayingView-panel, a.k.a. data-testid="NPV_Panel_OpenDiv"; on Spotify
// 1.3.3 the widget is only a hashed class, the panel's first child). Spotify 1.3.5
// has neither: see findWidget.
// Hidden when the song has no lyrics, and while the full lyrics page is open.
// Click the header to open the full page.

import { history } from "../platform";
import { mount } from "../react";
import { getSettings, watchSettings } from "../settings/store";
import { onDomChange } from "../watch";
import { useCurrentTrack, useLyrics } from "./hooks";
import { LyricsActions } from "./LyricsActions";
import { LyricsView } from "./LyricsView";
import { LYRICS_ROUTE, onLyricsRoute } from "./route";

function LyricsCard() {
  const track = useCurrentTrack();
  const state = useLyrics(track);
  if (state.status !== "ready" || !state.lyrics.lines.length || state.lyrics.kind === "static") return null;

  return (
    <section className="ghost-lyrics-card">
      <header className="ghost-lyrics-card__header">
        <button className="ghost-lyrics-card__title" onClick={() => history().push(LYRICS_ROUTE)}>
          Lyrics
        </button>
        <LyricsActions className="ghost-lyrics-card__actions" buttonClassName="ghost-lyrics-card__action" />
      </header>
      <LyricsView key={track?.uri} lyrics={state.lyrics} variant="card" />
    </section>
  );
}

export function initLyricsCard() {
  const host = document.createElement("div");
  host.className = "ghost-lyrics-card-host";
  let unmount: (() => void) | null = null;

  /** The block the card goes after. Spotify 1.3.5 dropped every readable class and
   *  test id in the panel (aside#Desktop_PanelContainer_Id); there the cover and the
   *  title row are separate, followed by groups of sections (credits, queue, …).
   *  So: walk up from the first section to the group whose previous sibling is the
   *  title row — it holds buttons (copy link, add to playlist) but, unlike the
   *  blocks below it (about the artist, merch), no h2 heading. */
  const findWidget = () => {
    const old = document.querySelector(
      ".main-nowPlayingView-panel > .main-nowPlayingView-nowPlayingWidget, [data-testid='NPV_Panel_OpenDiv'] > :first-child",
    );
    if (old) return old;
    const section = document.querySelector("#Desktop_PanelContainer_Id section:not(.ghost-lyrics-card)");
    for (let n = section; n?.parentElement; n = n.parentElement) {
      let prev = n.previousElementSibling;
      if (prev === host) prev = prev.previousElementSibling;
      if (prev?.querySelector("button") && !prev.querySelector("h2")) return prev;
    }
    return null;
  };

  const place = () => {
    const s = getSettings();
    const widget = findWidget();
    if (!s.lyricsPage || !s.lyricsCard || !widget || onLyricsRoute()) {
      unmount?.();
      unmount = null;
      host.remove();
      return;
    }
    // Moving a mounted React root to another spot is fine; it keeps its state.
    if (host.previousElementSibling !== widget) widget.after(host);
    if (!unmount) unmount = mount(<LyricsCard />, host);
  };

  // The now-playing view opens, closes and re-renders.
  onDomChange(place);
  history().listen(place);
  watchSettings((s) => [s.lyricsPage, s.lyricsCard], place);
  place();
}
