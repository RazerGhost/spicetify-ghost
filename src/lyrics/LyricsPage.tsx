// Lyrics for whatever is playing: follows songchange, loads via the providers,
// and shows loading / no-lyrics / instrumental states.

import { Icon } from "../icons";
import { openFullscreen } from "./fullscreen";
import { useCurrentTrack, useLyrics } from "./hooks";
import { LyricsBody } from "./LyricsBody";
import { pipSupported, togglePip } from "./pip";

export function LyricsPage() {
  const track = useCurrentTrack();
  const state = useLyrics(track);

  return (
    <div className="ghost-lyrics-page">
      <div className="ghost-lyrics-page__actions">
        {pipSupported() && (
          <button className="ghost-round-button" onClick={togglePip} title="Picture-in-picture" aria-label="Picture-in-picture">
            <Icon name="pip" />
          </button>
        )}
        <button className="ghost-round-button" onClick={openFullscreen} title="Fullscreen" aria-label="Fullscreen">
          <Icon name="expand" />
        </button>
      </div>
      <LyricsBody state={state} variant="page" trackUri={track?.uri} />
    </div>
  );
}
