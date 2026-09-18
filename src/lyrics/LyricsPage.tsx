// Lyrics for whatever is playing: follows songchange, loads via the providers,
// and shows loading / no-lyrics / instrumental states.

import { Icon } from "../icons";
import { openFullscreen } from "./fullscreen";
import { useCurrentTrack, useLyrics } from "./hooks";
import { LyricsBody } from "./LyricsBody";

export function LyricsPage() {
  const track = useCurrentTrack();
  const state = useLyrics(track);

  return (
    <div className="ghost-lyrics-page">
      <button className="ghost-round-button ghost-lyrics-page__fullscreen" onClick={openFullscreen} title="Fullscreen" aria-label="Fullscreen">
        <Icon name="expand" />
      </button>
      <LyricsBody state={state} variant="page" trackUri={track?.uri} />
    </div>
  );
}
