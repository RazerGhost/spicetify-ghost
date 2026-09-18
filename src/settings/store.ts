// Settings live in localStorage and are mirrored onto <html> as CSS variables
// (--ghost-*) and classes (ghost-grain, ghost-animated, …). user.css reads those,
// so most settings are purely a CSS concern. background.ts reacts to the
// background/accent source settings.

export type BackgroundSource = "art" | "custom" | "solid";
export type AccentSource = "art" | "custom" | "theme";
export type BannerMode = "fade" | "hide";
export type PlayerStyle = "floating" | "plain";

export type Settings = {
  // Background
  bgSource: BackgroundSource;
  bgImageUrl: string;
  bgColor: string;
  blur: number; // px
  brightness: number; // %
  saturation: number; // %
  contrast: number; // %
  animated: boolean;
  grain: boolean;
  // Colours
  accentSource: AccentSource;
  accentColor: string;
  tint: number; // % of accent mixed into surfaces
  // Artist banner
  bannerMode: BannerMode;
  bannerBlur: number; // px
  // Player bar
  playerStyle: PlayerStyle;
  playerWidth: number; // %
  playerHeight: number; // px
  showVolume: boolean;
  volumeStep: number; // % per wheel notch
  // Lyrics
  lyricsPage: boolean;
  lyricsSize: number; // px
  lyricsBlur: boolean;
  lyricsOffset: number; // ms; + = lyrics earlier
  lyricsCard: boolean;
  replaceFullscreen: boolean;
  romanize: boolean; // Korean built in
  romanizeJapanese: boolean; // downloads ~17 MB once
  romanizeChinese: boolean; // downloads ~320 KB once
  // Top bar & library
  navGlass: boolean;
  navAutoHide: boolean;
  slimRail: boolean;
  libraryAutoHide: boolean;
  hideWindowButtons: boolean;
  // Layout
  panelOpacity: number; // %
  borderOpacity: number; // %
  radius: number; // px
  gap: number; // px
  fadeEdges: boolean;
  hideCollapsedSidebar: boolean;
  canvasExpand: boolean;
};

export const DEFAULTS: Settings = {
  bgSource: "art",
  bgImageUrl: "",
  bgColor: "#0b0b0f",
  blur: 48,
  brightness: 45,
  saturation: 140,
  contrast: 100,
  animated: false,
  grain: true,
  accentSource: "art",
  accentColor: "#b9a4ff",
  tint: 10,
  bannerMode: "fade",
  bannerBlur: 0,
  playerStyle: "floating",
  playerWidth: 100,
  playerHeight: 72,
  showVolume: true,
  volumeStep: 2,
  lyricsPage: true,
  lyricsSize: 36,
  lyricsBlur: true,
  lyricsOffset: 0,
  lyricsCard: true,
  replaceFullscreen: true,
  romanize: true,
  romanizeJapanese: false,
  romanizeChinese: false,
  navGlass: true,
  navAutoHide: false,
  slimRail: true,
  libraryAutoHide: false,
  hideWindowButtons: true,
  panelOpacity: 35,
  borderOpacity: 6,
  radius: 12,
  gap: 8,
  fadeEdges: false,
  hideCollapsedSidebar: false,
  canvasExpand: false,
};

const KEY = "ghost:settings";
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    // v0.1 had a boolean instead of accentSource.
    if (saved.accentFromArt === false && !saved.accentSource) saved.accentSource = "theme";
    delete saved.accentFromArt;
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

let current = load();

export const getSettings = () => current;

// Sliders fire ~60 changes/s while dragging: apply instantly, persist shortly after.
let persistTimer: number | undefined;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => localStorage.setItem(KEY, JSON.stringify(current)), 250);
}
window.addEventListener("beforeunload", () => {
  clearTimeout(persistTimer);
  localStorage.setItem(KEY, JSON.stringify(current));
});

export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  persist();
  applySettings();
  listeners.forEach((l) => l());
}

export const resetSettings = () => setSettings(DEFAULTS);

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Call `onChange` only when the selected setting(s) change. `select` returns a
 *  value or array of values; they're compared by value. */
export function watchSettings(select: (s: Settings) => unknown, onChange: () => void) {
  const key = () => JSON.stringify(select(current));
  let last = key();
  return subscribe(() => {
    const next = key();
    if (next === last) return;
    last = next;
    onChange();
  });
}

// Surfaces that the accent tint is mixed into (see html.ghost-tinted in user.css).
// Their original color.ini values are copied to --ghost-base-* once, before the
// tint is applied, because a CSS variable can't be mixed with its own old value.
const TINTED = ["main", "main-elevated", "highlight", "highlight-elevated", "sidebar", "player", "card", "subtext"];
let baseCaptured = false;
const appliedVars: Record<string, string> = {};

// Returns false if colors.css isn't readable — then tinting stays off, because
// color-mix() with an empty variable would invalidate every surface colour.
function captureBaseColors(root: HTMLElement): boolean {
  const computed = getComputedStyle(root);
  const values = TINTED.map((key) => computed.getPropertyValue(`--spice-${key}`).trim());
  if (values.some((v) => !v)) return false;
  TINTED.forEach((key, i) => root.style.setProperty(`--ghost-base-${key}`, values[i]));
  return true;
}

export function applySettings() {
  const root = document.documentElement;
  const s = current;
  if (!baseCaptured) baseCaptured = captureBaseColors(root);

  const vars: Record<string, string> = {
    "--ghost-blur": `${s.blur}px`,
    "--ghost-brightness": `${s.brightness / 100}`,
    "--ghost-saturation": `${s.saturation / 100}`,
    "--ghost-contrast": `${s.contrast / 100}`,
    "--ghost-bg-color": s.bgColor,
    "--ghost-panel-alpha": `${s.panelOpacity / 100}`,
    "--ghost-border-alpha": `${s.borderOpacity / 100}`,
    "--ghost-radius": `${s.radius}px`,
    "--ghost-gap": `${s.gap}px`,
    "--ghost-tint": `${s.tint}%`,
    "--ghost-banner-blur": `${s.bannerBlur}px`,
    "--ghost-player-width": `${s.playerWidth}%`,
    "--ghost-player-height": `${s.playerHeight}px`,
    "--ghost-lyrics-size": `${s.lyricsSize}px`,
    "--ghost-lyrics-blur": s.lyricsBlur ? "0.8px" : "0px",
  };
  // Only write what changed: each write to <html> restyles the whole app.
  for (const [name, value] of Object.entries(vars)) {
    if (appliedVars[name] === value) continue;
    appliedVars[name] = value;
    root.style.setProperty(name, value);
  }

  root.classList.toggle("ghost-tinted", baseCaptured && s.tint > 0);
  root.classList.toggle("ghost-banner-hide", s.bannerMode === "hide");
  root.classList.toggle("ghost-player-floating", s.playerStyle === "floating");
  root.classList.toggle("ghost-nav-glass", s.navGlass);
  root.classList.toggle("ghost-nav-autohide", s.navAutoHide);
  root.classList.toggle("ghost-slim-rail", s.slimRail);
  root.classList.toggle("ghost-library-autohide", s.libraryAutoHide);
  root.classList.toggle("ghost-no-window-buttons", s.hideWindowButtons && navigator.userAgent.includes("Windows"));

  root.classList.toggle("ghost-grain", s.grain);
  root.classList.toggle("ghost-animated", s.animated && s.bgSource !== "solid");
  root.classList.toggle("ghost-bg-solid", s.bgSource === "solid");
  root.classList.toggle("ghost-fade-edges", s.fadeEdges);
  root.classList.toggle("ghost-hide-collapsed-sidebar", s.hideCollapsedSidebar);
}
