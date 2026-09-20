// Shared hooks for the lyrics page, the now-playing card and fullscreen.

import { useEffect, useState } from "react";
import { currentTrack } from "../player";
import { getLyrics } from "./providers";
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
  // Tagged with the track it belongs to: right after a song change, the render
  // before the effect runs must not show the previous song's lyrics.
  const [result, setResult] = useState<{ uri: string; state: LyricsState } | null>(null);
  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    getLyrics(track).then((lyrics) => {
      if (!cancelled) setResult({ uri: track.uri, state: lyrics ? { status: "ready", lyrics } : { status: "none" } });
    });
    return () => {
      cancelled = true;
    };
  }, [track?.uri]);
  if (!track) return { status: "none" };
  return result?.uri === track.uri ? result.state : { status: "loading" };
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
