// Ghost lyrics in the expanded now-playing view (Spotify 1.3.5's "cinema mode",
// see 32-npv-expanded.css). Its header has a media switch — artwork, canvas,
// artist image, lyrics — as four [role=radio] buttons. While the lyrics one is
// checked, Ghost's lyrics page replaces Spotify's lyrics. The radios are matched
// by position, not by their (localised) labels.
//
// On 1.3.6 the player bar's lyrics button opens this view in lyrics mode — but
// only for songs Spotify has lyrics for; otherwise it shows the artwork. Ghost
// finds lyrics for more songs (LRCLIB, AMLL), so a press of that button also
// shows Ghost's lyrics when the view opens right after it, until another mode is
// picked or the view closes. (On older versions the button goes to Ghost's
// lyrics page instead and the view doesn't open, so nothing changes there.)

import { mount } from "../react";
import { getSettings, watchSettings } from "../settings/store";
import { onDomChange } from "../watch";
import { LyricsPage } from "./LyricsPage";

const VIEW = ".Root__top-container > :has(> .over-cinema-scroll)";
const RADIOS = '[role="radiogroup"] > [role="radio"]';
/** How long after a lyrics-button press the view may still open and count. */
const PRESS_WINDOW_MS = 3000;

export function initExpandedLyrics() {
  const host = document.createElement("div");
  host.className = "ghost-npv-lyrics-host";
  let unmount: (() => void) | null = null;
  let view: Element | null = null;
  let pressedAt = 0; // last press of the player bar's lyrics button
  let wanted = false; // that press opened the view: show our lyrics even without Spotify's

  const sync = () => {
    const current = document.querySelector(VIEW);
    const radios = current?.querySelectorAll(RADIOS);
    const lyricsOn = radios?.length === 4 && radios[3].getAttribute("aria-checked") === "true";

    if (pressedAt && Date.now() - pressedAt >= PRESS_WINDOW_MS) pressedAt = 0;
    if (current && pressedAt) {
      wanted = true;
      pressedAt = 0;
    }
    if (!current) wanted = false;

    if (view && view !== current) view.classList.remove("ghost-npv-lyrics");
    view = current;

    if (!current || !(lyricsOn || wanted) || !getSettings().lyricsPage) {
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

  // Capture phase, before Spotify's handlers; neither click is swallowed.
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element | null;
      if (target?.closest?.('[data-testid="lyrics-button"]')) {
        // Pressed while our lyrics show: Spotify closes the view; let it.
        pressedAt = view && wanted ? 0 : Date.now();
        wanted = false;
        setTimeout(sync, 50);
      } else if (target?.closest?.(`${VIEW} ${RADIOS}`)) {
        // Another mode picked in the switch (or lyrics, which Spotify then handles).
        wanted = false;
        setTimeout(sync, 50);
      }
    },
    true,
  );

  // The switch only changes aria-checked (an attribute, which onDomChange doesn't
  // see), but Spotify swaps the hero's content with it, which it does.
  onDomChange(sync);
  watchSettings((s) => s.lyricsPage, sync);
  sync();
}
