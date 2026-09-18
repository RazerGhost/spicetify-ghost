// Lyrics for whatever is playing: follows songchange, loads via the providers,
// and shows loading / no-lyrics / instrumental states.

import { useEffect, useState } from "react";
import { LyricsView } from "./LyricsView";
import { currentTrack, getLyrics } from "./providers";
import type { Lyrics, TrackInfo } from "./types";

function useCurrentTrack(): TrackInfo | null {
  const [track, setTrack] = useState(currentTrack);
  useEffect(() => {
    const update = () => setTrack(currentTrack());
    Spicetify.Player.addEventListener("songchange", update);
    update();
    return () => Spicetify.Player.removeEventListener("songchange", update);
  }, []);
  return track;
}

type State = { status: "loading" } | { status: "none" } | { status: "ready"; lyrics: Lyrics };

function useLyrics(track: TrackInfo | null): State {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    if (!track) return setState({ status: "none" });
    let cancelled = false;
    setState({ status: "loading" });
    getLyrics(track).then((lyrics) => {
      if (!cancelled) setState(lyrics ? { status: "ready", lyrics } : { status: "none" });
    });
    return () => {
      cancelled = true;
    };
  }, [track?.uri]);
  return state;
}

export function LyricsPage() {
  const track = useCurrentTrack();
  const state = useLyrics(track);

  let body;
  if (state.status === "loading") body = <p className="ghost-lyrics-status">Loading lyrics…</p>;
  else if (state.status === "none") body = <p className="ghost-lyrics-status">No lyrics for this song</p>;
  else if (!state.lyrics.lines.length) body = <p className="ghost-lyrics-status">Instrumental ♪</p>;
  else body = <LyricsView key={track?.uri} lyrics={state.lyrics} />;

  return <div className="ghost-lyrics-page">{body}</div>;
}
