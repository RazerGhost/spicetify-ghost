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

import { getSettings, subscribe } from "./settings/store";

const isWindows = navigator.userAgent.includes("Windows");

async function setTitlebarHeight(height: number) {
  const msg = { height };
  const platform = Spicetify.Platform as any;
  // Which of these exists depends on the Spotify version; try all, ignore failures.
  await Promise.allSettled([
    platform?.ControlMessageAPI?._updateUiClient?.updateTitlebarHeight?.(msg),
    platform?.UpdateAPI?._updateUiClient?.updateTitlebarHeight?.(msg),
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
let nativeApi: { setWindowButtonsVisibility(show: boolean): Promise<void> } | null | undefined;

function findNativeApi() {
  if (nativeApi !== undefined) return nativeApi;
  const platform = Spicetify.Platform as any;
  nativeApi = platform?.NativeAPI?.setWindowButtonsVisibility ? platform.NativeAPI : null;
  if (!nativeApi && platform) {
    for (const key of Object.keys(platform)) {
      try {
        if (typeof platform[key]?.setWindowButtonsVisibility === "function") {
          nativeApi = platform[key];
          break;
        }
      } catch {
        // some Platform getters throw; skip them
      }
    }
  }
  return nativeApi;
}

function applyButtonVisibility() {
  const hide = getSettings().hideWindowButtons;
  findNativeApi()?.setWindowButtonsVisibility(!hide)?.catch?.(() => {});
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

  let key = "";
  subscribe(() => {
    const s = getSettings();
    const next = `${s.navGlass}|${s.navAutoHide}|${s.gap}|${s.hideWindowButtons}`;
    if (next !== key) {
      key = next;
      apply();
    }
  });

  // Zoom changes fire resize and make Spotify re-send its value; leaving
  // fullscreen makes it show the buttons again. Follow up after both.
  let timer: number | undefined;
  const later = () => {
    clearTimeout(timer);
    timer = window.setTimeout(applyRepeatedly, 300);
  };
  window.addEventListener("resize", later);
  document.addEventListener("fullscreenchange", later);
}
