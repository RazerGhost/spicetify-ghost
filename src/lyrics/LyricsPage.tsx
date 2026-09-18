// Lyrics for whatever is playing: follows songchange, loads via the providers,
// and shows loading / no-lyrics / instrumental states.

import { useCurrentTrack, useLyrics } from "./hooks";
import { LyricsBody } from "./LyricsBody";
import { openFullscreen } from "./fullscreen";

export const EXPAND_ICON = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M1.5 1h4v1.5H3.56l3 3-1.06 1.06-3-3V5.5H1V1.5A.5.5 0 0 1 1.5 1Zm13 0a.5.5 0 0 1 .5.5v4h-1.5V3.56l-3 3-1.06-1.06 3-3H10.5V1h4ZM2.5 12.44l3-3 1.06 1.06-3 3H5.5V15h-4a.5.5 0 0 1-.5-.5v-4h1.5v1.94Zm12.5-1.94v4a.5.5 0 0 1-.5.5h-4v-1.5h1.94l-3-3 1.06-1.06 3 3V10.5H15Z" />
  </svg>
);

export function LyricsPage() {
  const track = useCurrentTrack();
  const state = useLyrics(track);

  return (
    <div className="ghost-lyrics-page">
      <button className="ghost-round-button ghost-lyrics-page__fullscreen" onClick={openFullscreen} title="Fullscreen" aria-label="Fullscreen">
        {EXPAND_ICON}
      </button>
      <LyricsBody state={state} variant="page" trackUri={track?.uri} />
    </div>
  );
}
