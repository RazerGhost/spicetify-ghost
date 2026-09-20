// Picture-in-picture and fullscreen buttons, shown on the lyrics page and the
// now-playing card.

import { Icon } from "../icons";
import { openFullscreen } from "./fullscreen";
import { pipSupported, togglePip } from "./pip";

export function LyricsActions({ className, buttonClassName }: { className: string; buttonClassName?: string }) {
  const button = buttonClassName ? `ghost-round-button ${buttonClassName}` : "ghost-round-button";
  return (
    <div className={className}>
      {pipSupported() && (
        <button className={button} onClick={togglePip} title="Picture-in-picture" aria-label="Picture-in-picture">
          <Icon name="pip" />
        </button>
      )}
      <button className={button} onClick={openFullscreen} title="Fullscreen" aria-label="Fullscreen">
        <Icon name="expand" />
      </button>
    </div>
  );
}
