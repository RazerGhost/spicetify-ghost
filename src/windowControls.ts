// Windows: the minimise / maximise / close buttons and the ⋯ app menu are native,
// drawn over the window, so CSS can't restyle them. Two things we can do:
//   1. hide them (setting "Hide window buttons") — NativeAPI.setWindowButtonsVisibility,
//      the switch Spotify itself uses in fullscreen. The page has no minimise /
//      maximise API, so there's no replacement: Win+↓ / Win+↑ / Alt+F4, or
//      double-click the top bar to maximise.
//   2. otherwise set the native title-bar height so they're centred on Ghost's bar.
//
// How Spotify does it (xpui-modules.js):
//   - at startup:            ControlMessageAPI.setTitlebarHeight(64)
//   - on every zoom change:  setTitlebarHeight(64 * ZOOM_FACTORS[viewportZoom])
// So the value is the bar height in CSS px *times the UI zoom factor*, and
// Spotify re-sends its own 64-based value whenever zoom changes — we have to
// re-apply ours after it (same reason Lucid re-sends for a few seconds).

import { isWindows, platform, type GhostPlatform } from "./platform";
import { getSettings, watchSettings } from "./settings/store";

async function setTitlebarHeight(height: number) {
  const msg = { height };
  const p = platform();
  // Which of these exists depends on the Spotify version; try all, ignore failures.
  await Promise.allSettled([
    p.ControlMessageAPI?._updateUiClient?.updateTitlebarHeight?.(msg),
    p.UpdateAPI?._updateUiClient?.updateTitlebarHeight?.(msg),
    Spicetify.CosmosAsync?.post("sp://messages/v1/container/control", {
      type: "update_titlebar",
      height: `${height}px`,
    }),
  ]);
}

// Spotify's UI zoom factor. .Root carries --zoom-level (e.g. 69 for 0.694);
// Spotify's own table is slightly more precise, but this is within a pixel.
function zoomFactor(): number {
  const root = document.querySelector<HTMLElement>(".Root");
  const level = parseFloat(root?.style.getPropertyValue("--zoom-level") ?? "");
  return Number.isFinite(level) && level > 0 ? level / 100 : 1;
}

// The API object is registered as "NativeAPI"; look it up on Spicetify.Platform,
// falling back to any Platform entry that has the method (names can change).
// Only a hit is cached: early on the API may not be registered yet.
type NativeApi = Required<NonNullable<GhostPlatform["NativeAPI"]>>;
let nativeApi: NativeApi | null = null;

function findNativeApi(): NativeApi | null {
  if (nativeApi) return nativeApi;
  const p = platform() as Record<string, any>;
  let found: NativeApi | null = null;
  for (const key of ["NativeAPI", ...Object.keys(p)]) {
    try {
      if (typeof p[key]?.setWindowButtonsVisibility === "function") {
        found = p[key];
        break;
      }
    } catch {
      // some Platform getters throw; skip them
    }
  }
  return (nativeApi = found);
}

/** Set while a view covers the window (Ghost's fullscreen filling the window):
 *  the native buttons are drawn over the page and would take clicks from it. */
let forcedHidden = false;

function applyButtonVisibility() {
  const hidden = forcedHidden || getSettings().hideWindowButtons;
  findNativeApi()?.setWindowButtonsVisibility(!hidden).catch(() => {});
}

/** Hide the native window buttons while `hidden`, then go back to the setting. */
export function forceHideWindowButtons(hidden: boolean) {
  forcedHidden = hidden;
  applyButtonVisibility();
}

function apply() {
  applyButtonVisibility();
  const s = getSettings();
  // Global-nav row in CSS px: Ghost's 52px glass bar (or Spotify's 48px) plus
  // the panel gap above and below it — the same 64px Spotify uses by default.
  const barHeight = s.navGlass || s.navAutoHide ? 52 : 48;
  setTitlebarHeight((barHeight + s.gap * 2) * zoomFactor());
}

// Apply now and again shortly after, so we land after Spotify's own calls.
function applyRepeatedly() {
  for (const delay of [0, 500, 1500, 3000]) setTimeout(apply, delay);
}

export function initWindowControls() {
  if (!isWindows) return;
  applyRepeatedly();

  watchSettings((s) => [s.navGlass, s.navAutoHide, s.gap, s.hideWindowButtons], apply);

  // Zoom changes fire resize and make Spotify re-send its value; leaving
  // fullscreen makes it show the buttons again. Follow up after both — but a
  // plain window resize (zoom unchanged) needs nothing.
  // (Compared after the debounce: Spotify may update --zoom-level after resize.)
  let timer: number | undefined;
  let zoom = zoomFactor();
  let force = false; // a fullscreen change is pending (it also fires resize)
  const later = (always: boolean) => {
    force ||= always;
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      const now = zoomFactor();
      if (!force && now === zoom) return;
      force = false;
      zoom = now;
      applyRepeatedly();
    }, 300);
  };
  window.addEventListener("resize", () => later(false));
  document.addEventListener("fullscreenchange", () => later(true));
}
