// Compact lyrics card in the now-playing view (right sidebar), placed right after
// the cover/canvas block (.main-nowPlayingView-nowPlayingWidget inside
// .main-nowPlayingView-panel, a.k.a. data-testid="NPV_Panel_OpenDiv").
// Hidden when the song has no lyrics. Click the header to open the full page.

import { mount } from "../react";
import { getSettings, subscribe } from "../settings/store";
import { openFullscreen } from "./fullscreen";
import { useCurrentTrack, useLyrics } from "./hooks";
import { LyricsView } from "./LyricsView";
import { EXPAND_ICON } from "./LyricsPage";

const WIDGET = ".main-nowPlayingView-panel > .main-nowPlayingView-nowPlayingWidget";

function LyricsCard() {
  const track = useCurrentTrack();
  const state = useLyrics(track);
  if (state.status !== "ready" || !state.lyrics.lines.length || state.lyrics.kind === "static") return null;

  return (
    <section className="ghost-lyrics-card">
      <header className="ghost-lyrics-card__header">
        <button className="ghost-lyrics-card__title" onClick={() => (Spicetify.Platform as any).History.push("/lyrics")}>
          Lyrics
        </button>
        <button className="ghost-round-button ghost-lyrics-card__expand" onClick={openFullscreen} title="Fullscreen" aria-label="Fullscreen">
          {EXPAND_ICON}
        </button>
      </header>
      <LyricsView key={track?.uri} lyrics={state.lyrics} variant="card" />
    </section>
  );
}

export function initLyricsCard() {
  const host = document.createElement("div");
  host.className = "ghost-lyrics-card-host";
  let unmount: (() => void) | null = null;

  const place = () => {
    const s = getSettings();
    const widget = document.querySelector(WIDGET);
    if (!s.lyricsPage || !s.lyricsCard || !widget) {
      unmount?.();
      unmount = null;
      host.remove();
      return;
    }
    // Moving a mounted React root to another spot is fine; it keeps its state.
    if (host.previousElementSibling !== widget) widget.after(host);
    if (!unmount) unmount = mount(<LyricsCard />, host);
  };

  // The now-playing view opens, closes and re-renders; re-place at most once per frame.
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      place();
    });
  }).observe(document.body, { childList: true, subtree: true });

  subscribe(place);
  place();
}
