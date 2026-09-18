// Fullscreen / cinema view: cover, track info, progress and controls on the left,
// synced lyrics on the right. It has no background of its own — fullscreen.tsx
// hides .Root, so Ghost's album-art background (#ghost-bg) shows through.
// (Named FullscreenView, not Fullscreen: Windows file names are case-insensitive
// and would collide with fullscreen.tsx.)

import { useEffect, useRef, useState } from "react";
import { albumArt } from "../background";
import { Icon } from "../icons";
import { useCurrentTrack, useLyrics, usePlaying } from "./hooks";
import { LyricsBody } from "./LyricsBody";

function formatTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Updated per frame straight on the DOM (no React re-renders), and only when
// something visibly changed — nothing is written while paused.
function Progress() {
  const fill = useRef<HTMLDivElement>(null);
  const elapsed = useRef<HTMLSpanElement>(null);
  const total = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    let lastPosition = -1;
    let lastElapsed = "";
    let lastTotal = "";
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const position = Spicetify.Player.getProgress();
      if (position === lastPosition) return;
      lastPosition = position;
      const duration = Spicetify.Player.getDuration() || 1;
      fill.current?.style.setProperty("width", `${Math.min(100, (position / duration) * 100)}%`);
      const e = formatTime(position);
      const t = formatTime(duration);
      if (e !== lastElapsed && elapsed.current) elapsed.current.textContent = lastElapsed = e;
      if (t !== lastTotal && total.current) total.current.textContent = lastTotal = t;
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, []);

  const onSeek = (e: { currentTarget: HTMLDivElement; clientX: number }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    Spicetify.Player.seek(Math.round(fraction * Spicetify.Player.getDuration()));
  };

  return (
    <div className="ghost-fs__progress">
      <div className="ghost-fs__bar" onClick={onSeek}>
        <div ref={fill} className="ghost-fs__fill" />
      </div>
      <div className="ghost-fs__times">
        <span ref={elapsed} />
        <span ref={total} />
      </div>
    </div>
  );
}

export function FullscreenView({ onClose }: { onClose: () => void }) {
  const track = useCurrentTrack();
  const state = useLyrics(track);
  const playing = usePlaying();
  const [art, setArt] = useState(albumArt);
  const [idle, setIdle] = useState(false);

  useEffect(() => setArt(albumArt()), [track?.uri]);

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
        {art && <img className="ghost-fs__cover" src={art} alt="" />}
        <div className="ghost-fs__meta">
          <div className="ghost-fs__title">{track?.title}</div>
          <div className="ghost-fs__artist">{track?.artist}</div>
        </div>
        <Progress />
        <div className="ghost-fs__controls">
          <button className="ghost-round-button" onClick={() => Spicetify.Player.back()} aria-label="Previous">
            <Icon name="prev" size={18} />
          </button>
          <button className="ghost-round-button ghost-fs__play" onClick={() => Spicetify.Player.togglePlay()} aria-label={playing ? "Pause" : "Play"}>
            <Icon name={playing ? "pause" : "play"} size={22} />
          </button>
          <button className="ghost-round-button" onClick={() => Spicetify.Player.next()} aria-label="Next">
            <Icon name="next" size={18} />
          </button>
        </div>
      </div>

      {hasLyrics && (
        <div className="ghost-fs__lyrics">
          <LyricsBody state={state} variant="fullscreen" trackUri={track?.uri} />
        </div>
      )}
    </div>
  );
}
