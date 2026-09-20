// Playback controls shared by the fullscreen and picture-in-picture views.

import { useEffect, useRef } from "react";
import { Icon } from "../icons";
import { usePlaying } from "./hooks";

function formatTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Updated per frame straight on the DOM (no React re-renders), and only when
// something visibly changed — nothing is written while paused. Uses the rAF of
// the window it's rendered in (the PiP window keeps running while Spotify's
// main window is minimised).
export function Progress() {
  const fill = useRef<HTMLDivElement>(null);
  const elapsed = useRef<HTMLSpanElement>(null);
  const total = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const win = fill.current?.ownerDocument.defaultView ?? window;
    let frame = 0;
    let lastPosition = -1;
    let lastElapsed = "";
    let lastTotal = "";
    const tick = () => {
      frame = win.requestAnimationFrame(tick);
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
    return () => win.cancelAnimationFrame(frame);
  }, []);

  const onSeek = (e: { currentTarget: HTMLDivElement; clientX: number }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    Spicetify.Player.seek(Math.round(fraction * Spicetify.Player.getDuration()));
  };

  return (
    <div className="ghost-progress">
      <div className="ghost-progress__bar" onClick={onSeek}>
        <div ref={fill} className="ghost-progress__fill" />
      </div>
      <div className="ghost-progress__times">
        <span ref={elapsed} />
        <span ref={total} />
      </div>
    </div>
  );
}

/** Previous / play-pause / next. */
export function PlayerControls({ className, iconSize = 16, playIconSize = iconSize }: { className: string; iconSize?: number; playIconSize?: number }) {
  const playing = usePlaying();
  return (
    <div className={className}>
      <button className="ghost-round-button" onClick={() => Spicetify.Player.back()} aria-label="Previous">
        <Icon name="prev" size={iconSize} />
      </button>
      <button className="ghost-round-button ghost-controls__play" onClick={() => Spicetify.Player.togglePlay()} aria-label={playing ? "Pause" : "Play"}>
        <Icon name={playing ? "pause" : "play"} size={playIconSize} />
      </button>
      <button className="ghost-round-button" onClick={() => Spicetify.Player.next()} aria-label="Next">
        <Icon name="next" size={iconSize} />
      </button>
    </div>
  );
}
