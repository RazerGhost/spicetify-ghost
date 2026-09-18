// Volume percentage next to the volume slider — replaces daksh2k's
// "Volume Percentage" extension — plus finer control than Spotify's slider:
//   - mouse wheel over the volume bar: ±step % (Shift = 5× step)
//   - click the percentage to type an exact value (Enter / blur = apply, Esc = cancel)
// Re-attaches when Spotify re-renders the player bar.

import { getSettings, subscribe } from "./settings/store";
import { onDomChange } from "./watch";

const BAR = ".main-nowPlayingBar-volumeBar";

const label = document.createElement("span");
label.className = "ghost-volume";
label.tabIndex = 0;
label.setAttribute("role", "button");
label.title = "Click to type a volume · scroll over the bar to fine-tune";

let editing = false;

function currentPercent(): number | undefined {
  const volume = Spicetify.Player.getVolume?.();
  // getVolume() is -1 until Spotify knows the volume.
  return typeof volume === "number" && volume >= 0 ? Math.round(volume * 100) : undefined;
}

function setPercent(percent: number) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  Spicetify.Player.setVolume(clamped / 100);
}

function update() {
  if (editing) return;
  const percent = currentPercent();
  label.textContent = percent === undefined ? "" : `${percent}%`;
}

// --- click-to-type ---------------------------------------------------------

function startEditing() {
  if (editing) return;
  editing = true;
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = "100";
  input.className = "ghost-volume__input";
  input.value = String(currentPercent() ?? "");
  label.replaceChildren(input);
  input.focus();
  input.select();

  const finish = (apply: boolean) => {
    if (!editing) return;
    editing = false;
    const value = Number(input.value);
    if (apply && input.value !== "" && Number.isFinite(value)) setPercent(value);
    update();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    else if (e.key === "Escape") finish(false);
    e.stopPropagation(); // keep Spotify's shortcuts (space = play/pause) out of the field
  });
  input.addEventListener("blur", () => finish(true));
}

label.addEventListener("click", startEditing);
label.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    startEditing();
  }
});

// --- mouse wheel -----------------------------------------------------------

// Touchpads send many small deltas; accumulate until a "notch" worth has built up.
const NOTCH = 40;
let wheelAccumulator = 0;

function onWheel(e: WheelEvent) {
  e.preventDefault();
  wheelAccumulator += e.deltaY;
  if (Math.abs(wheelAccumulator) < NOTCH) return;
  const direction = wheelAccumulator < 0 ? 1 : -1; // wheel up = louder
  wheelAccumulator = 0;
  const step = getSettings().volumeStep * (e.shiftKey ? 5 : 1);
  const percent = currentPercent();
  if (percent !== undefined) setPercent(percent + direction * step);
}

// --- attach ----------------------------------------------------------------

let wheelTarget: Element | null = null;

// (Re)attach to the volume bar; the label only when enabled, the wheel always.
function sync() {
  const bar = document.querySelector(BAR);
  if (bar !== wheelTarget) {
    wheelTarget?.removeEventListener("wheel", onWheel as EventListener);
    bar?.addEventListener("wheel", onWheel as EventListener, { passive: false });
    wheelTarget = bar;
  }
  if (!getSettings().showVolume) {
    label.remove();
    return;
  }
  if (bar && label.parentElement !== bar) bar.append(label);
  update();
}

export function initVolume() {
  (Spicetify.Platform as any)?.PlaybackAPI?._events?.addListener?.("volume", update);
  subscribe(sync);

  // The player bar can be re-rendered (mini player, fullscreen, layout changes);
  // re-attach when the bar we're on is gone, or our label disappeared.
  onDomChange(() => {
    const barGone = wheelTarget !== null && !wheelTarget.isConnected;
    const labelGone = getSettings().showVolume && !label.isConnected;
    if (barGone || labelGone || wheelTarget === null) sync();
  });

  sync();
}
