// Lyrics for whatever is playing: follows songchange, loads via the providers,
// and shows loading / no-lyrics / instrumental states.

import { useCurrentTrack, useLyrics } from "./hooks";
import { LyricsActions } from "./LyricsActions";
import { LyricsBody } from "./LyricsBody";

export function LyricsPage() {
  const track = useCurrentTrack();
  const state = useLyrics(track);

  return (
    <div className="ghost-lyrics-page">
      <LyricsActions className="ghost-lyrics-page__actions" />
      <LyricsBody state={state} variant="page" trackUri={track?.uri} />
    </div>
  );
}
