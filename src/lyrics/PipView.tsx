// Contents of the picture-in-picture window: the (already baked) Ghost
// background, a compact now-playing header, synced lyrics, and controls that
// appear on hover.

import { useEffect, useState } from "react";
import { albumArt, currentBackground, onBackgroundChange } from "../background";
import { Icon } from "../icons";
import { Progress } from "./FullscreenView";
import { useCurrentTrack, useLyrics, usePlaying } from "./hooks";
import { LyricsBody } from "./LyricsBody";

const closeWindow = (e: { currentTarget: Element }) => e.currentTarget.ownerDocument.defaultView?.close();

function useBackground() {
  const [image, setImage] = useState(currentBackground);
  useEffect(() => onBackgroundChange(setImage), []);
  return image;
}

export function PipView() {
  const track = useCurrentTrack();
  const state = useLyrics(track);
  const playing = usePlaying();
  const background = useBackground();
  const [art, setArt] = useState(albumArt);
  useEffect(() => setArt(albumArt()), [track?.uri]);

  return (
    <div className="ghost-pip">
      <div
        className={`ghost-pip__bg${background?.live ? " ghost-pip__bg--live" : ""}`}
        style={background ? { backgroundImage: `url("${background.url}")` } : undefined}
      />

      <header className="ghost-pip__header">
        {art && <img className="ghost-pip__cover" src={art} alt="" />}
        <div className="ghost-pip__meta">
          <div className="ghost-pip__title">{track?.title}</div>
          <div className="ghost-pip__artist">{track?.artist}</div>
        </div>
        {/* Always closeable from inside — the open/close buttons elsewhere can be
            gone (e.g. the card hides for songs without lyrics). */}
        <button className="ghost-round-button ghost-pip__close" onClick={closeWindow} title="Close" aria-label="Close">
          <Icon name="close" />
        </button>
      </header>

      <div className="ghost-pip__lyrics">
        <LyricsBody state={state} variant="pip" trackUri={track?.uri} />
      </div>

      <footer className="ghost-pip__controls">
        <Progress />
        <div className="ghost-pip__buttons">
          <button className="ghost-round-button" onClick={() => Spicetify.Player.back()} aria-label="Previous">
            <Icon name="prev" />
          </button>
          <button className="ghost-round-button ghost-pip__play" onClick={() => Spicetify.Player.togglePlay()} aria-label={playing ? "Pause" : "Play"}>
            <Icon name={playing ? "pause" : "play"} />
          </button>
          <button className="ghost-round-button" onClick={() => Spicetify.Player.next()} aria-label="Next">
            <Icon name="next" />
          </button>
        </div>
      </footer>
    </div>
  );
}
