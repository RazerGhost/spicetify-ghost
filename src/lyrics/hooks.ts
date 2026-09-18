// Shared hooks for the lyrics page, the now-playing card and fullscreen.

import { useEffect, useState } from "react";
import { currentTrack, getLyrics } from "./providers";
import type { Lyrics, TrackInfo } from "./types";

export function useCurrentTrack(): TrackInfo | null {
  const [track, setTrack] = useState(currentTrack);
  useEffect(() => {
    const update = () => setTrack(currentTrack());
    Spicetify.Player.addEventListener("songchange", update);
    update();
    return () => Spicetify.Player.removeEventListener("songchange", update);
  }, []);
  return track;
}

export type LyricsState = { status: "loading" } | { status: "none" } | { status: "ready"; lyrics: Lyrics };

export function useLyrics(track: TrackInfo | null): LyricsState {
  const [state, setState] = useState<LyricsState>({ status: "loading" });
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

export function usePlaying(): boolean {
  const [playing, setPlaying] = useState(() => Spicetify.Player.isPlaying());
  useEffect(() => {
    const update = () => setPlaying(Spicetify.Player.isPlaying());
    Spicetify.Player.addEventListener("onplaypause", update);
    return () => Spicetify.Player.removeEventListener("onplaypause", update);
  }, []);
  return playing;
}
