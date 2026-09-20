// Fullscreen / cinema view: cover, track info, progress and controls on the left,
// synced lyrics on the right. It has no background of its own — fullscreen.tsx
// hides .Root, so Ghost's album-art background (#ghost-bg) shows through.
// (Named FullscreenView, not Fullscreen: Windows file names are case-insensitive
// and would collide with fullscreen.tsx.)

import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { PlayerControls, Progress } from "./controls";
import { useCurrentTrack, useLyrics } from "./hooks";
import { LyricsBody } from "./LyricsBody";

export function FullscreenView({ onClose }: { onClose: () => void }) {
  const track = useCurrentTrack();
  const state = useLyrics(track);
  const [idle, setIdle] = useState(false);

  // Hide the cursor and chrome after 3s without mouse movement.
  useEffect(() => {
    let timer = window.setTimeout(() => setIdle(true), 3000);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), 3000);
    };
    window.addEventListener("mousemove", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
    };
  }, []);

  const hasLyrics = state.status === "ready" && state.lyrics.lines.length > 0;

  return (
    <div className={`ghost-fs${hasLyrics ? "" : " ghost-fs--no-lyrics"}${idle ? " ghost-fs--idle" : ""}`}>
      <button className="ghost-round-button ghost-fs__close" onClick={onClose} title="Exit fullscreen (Esc)" aria-label="Exit fullscreen">
        <Icon name="close" />
      </button>

      <div className="ghost-fs__now">
        {track?.image && <img className="ghost-fs__cover" src={track.image} alt="" />}
        <div className="ghost-fs__meta">
          <div className="ghost-fs__title">{track?.title}</div>
          <div className="ghost-fs__artist">{track?.artist}</div>
        </div>
        <Progress />
        <PlayerControls className="ghost-fs__controls" iconSize={18} playIconSize={22} />
      </div>

      {hasLyrics && (
        <div className="ghost-fs__lyrics">
          <LyricsBody state={state} variant="fullscreen" trackUri={track?.uri} />
        </div>
      )}
    </div>
  );
}
