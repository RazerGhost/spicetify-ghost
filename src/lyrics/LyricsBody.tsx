// The lyrics view for a loading state, or a status message. Used by the lyrics
// page, the now-playing card and fullscreen.

import type { LyricsState } from "./hooks";
import { LyricsView, type LyricsVariant } from "./LyricsView";

export function LyricsBody({ state, variant, trackUri }: { state: LyricsState; variant: LyricsVariant; trackUri?: string }) {
  if (state.status === "loading") return <p className="ghost-lyrics-status">Loading lyrics…</p>;
  if (state.status === "none") return <p className="ghost-lyrics-status">No lyrics for this song</p>;
  if (!state.lyrics.lines.length) return <p className="ghost-lyrics-status">Instrumental ♪</p>;
  return <LyricsView key={trackUri} lyrics={state.lyrics} variant={variant} />;
}
