// Fullscreen / cinema view: cover, track info, progress and controls on the left,
// synced lyrics on the right. It has no background of its own — fullscreen.tsx
// hides .Root, so Ghost's album-art background (#ghost-bg) shows through.
// (Named FullscreenView, not Fullscreen: Windows file names are case-insensitive
// and would collide with fullscreen.tsx.)

import { useEffect, useRef, useState } from "react";
import { albumArt } from "../background";
import { useCurrentTrack, useLyrics, usePlaying } from "./hooks";
import { LyricsBody } from "./LyricsBody";

const icon = (d: string, size = 20) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
);

const ICONS = {
  play: "M3 1.7v12.6a.7.7 0 0 0 1.05.6l10.9-6.3a.7.7 0 0 0 0-1.2L4.05 1.1A.7.7 0 0 0 3 1.7Z",
  pause: "M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7Zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6Z",
  next: "M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.1A.7.7 0 0 0 1 1.7v12.6a.7.7 0 0 0 1.05.6L12 9.15v5.15a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-1.6Z",
  prev: "M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.75a.7.7 0 0 1 1.05.6v12.6a.7.7 0 0 1-1.05.6L4 9.15v5.15a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7h1.6Z",
  close: "M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 1 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06Z",
};

function formatTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Updated per frame straight on the DOM (no React re-renders).
function Progress() {
  const fill = useRef<HTMLDivElement>(null);
  const elapsed = useRef<HTMLSpanElement>(null);
  const total = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const position = Spicetify.Player.getProgress();
      const duration = Spicetify.Player.getDuration() || 1;
      fill.current?.style.setProperty("width", `${Math.min(100, (position / duration) * 100)}%`);
      if (elapsed.current) elapsed.current.textContent = formatTime(position);
      if (total.current) total.current.textContent = formatTime(duration);
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
        {icon(ICONS.close, 16)}
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
            {icon(ICONS.prev, 18)}
          </button>
          <button className="ghost-round-button ghost-fs__play" onClick={() => Spicetify.Player.togglePlay()} aria-label={playing ? "Pause" : "Play"}>
            {icon(playing ? ICONS.pause : ICONS.play, 22)}
          </button>
          <button className="ghost-round-button" onClick={() => Spicetify.Player.next()} aria-label="Next">
            {icon(ICONS.next, 18)}
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
