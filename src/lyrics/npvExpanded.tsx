// Ghost lyrics in the expanded now-playing view (Spotify 1.3.5's "cinema mode",
// see 32-npv-expanded.css). Its header has a media switch — artwork, canvas,
// artist image, lyrics — as four [role=radio] buttons. While the lyrics one is
// checked, Ghost's lyrics page replaces Spotify's lyrics. The radios are matched
// by position, not by their (localised) labels.

import { mount } from "../react";
import { getSettings, watchSettings } from "../settings/store";
import { onDomChange } from "../watch";
import { LyricsPage } from "./LyricsPage";

const VIEW = ".Root__top-container > :has(> .over-cinema-scroll)";

export function initExpandedLyrics() {
  const host = document.createElement("div");
  host.className = "ghost-npv-lyrics-host";
  let unmount: (() => void) | null = null;
  let view: Element | null = null;

  const sync = () => {
    const current = document.querySelector(VIEW);
    const radios = current?.querySelectorAll('[role="radiogroup"] > [role="radio"]');
    const lyricsOn = radios?.length === 4 && radios[3].getAttribute("aria-checked") === "true";

    if (view && view !== current) view.classList.remove("ghost-npv-lyrics");
    view = current;

    if (!current || !lyricsOn || !getSettings().lyricsPage) {
      current?.classList.remove("ghost-npv-lyrics");
      unmount?.();
      unmount = null;
      host.remove();
      return;
    }
    current.classList.add("ghost-npv-lyrics");
    if (host.parentElement !== current) current.append(host);
    if (!unmount) unmount = mount(<LyricsPage />, host);
  };

  // The switch only changes aria-checked (an attribute, which onDomChange doesn't
  // see), but Spotify swaps the hero's content with it, which it does.
  onDomChange(sync);
  watchSettings((s) => s.lyricsPage, sync);
  sync();
}
