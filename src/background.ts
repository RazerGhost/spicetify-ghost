// Background: two stacked layers that crossfade whenever the image changes
// (the accent colour is in accent.ts).
// Source is the current album art, a custom image URL, or nothing (solid colour).
//
// Performance: the image is blurred ONCE per song into a small canvas (1/SCALE of
// the window, with brightness/saturation/contrast baked in) and shown stretched.
// A live CSS `filter: blur()` on two full-window layers made Chromium redo a large
// blur on every redrawn frame — i.e. during every page change and scroll.
// i.scdn.co sends Access-Control-Allow-Origin: *, so covers can be exported from
// the canvas. Custom images without CORS fall back to the live CSS filter
// (.ghost-bg__layer--live in user.css).

import { albumArt, onSongChange } from "./player";
import { platform } from "./platform";
import { getSettings, watchSettings, type Settings } from "./settings/store";

/** Canvas is rendered at 1/SCALE of the window and upscaled; invisible after a heavy blur. */
const SCALE = 8;

let layers: [HTMLElement, HTMLElement];
let active = 0;
let lastImage = "";
/** Decoded image currently shown — kept so filter/size changes can re-render it. */
let shownImage: HTMLImageElement | null = null;
const layerUrls = new WeakMap<HTMLElement, string>();

let lastError = "";

/** Snapshot of what the background code sees — exposed as ghost.bg() in dev builds. */
export function debugBackground() {
  const item = Spicetify.Player.data?.item;
  const meta = item?.metadata;
  return {
    settings: { bgSource: getSettings().bgSource, bgImageUrl: getSettings().bgImageUrl },
    track: item?.name,
    mediaType: item?.mediaType,
    candidates: {
      image_xlarge_url: meta?.image_xlarge_url,
      image_large_url: meta?.image_large_url,
      image_url: meta?.image_url,
      images: item?.images,
      albumImages: item?.album?.images,
    },
    resolved: wantedImage(getSettings()),
    lastImage,
    lastError,
    activeLayers: layers?.filter((l) => l.classList.contains("ghost-active")).length,
  };
}

function wantedImage(s: Settings): string {
  if (s.bgSource === "solid") return "";
  if (s.bgSource === "custom") return s.bgImageUrl.trim();
  return albumArt() ?? "";
}

function loadImage(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Blur + colour-adjust `img` into a small canvas; object URL, or null if the
 *  canvas is tainted (image without CORS) and can't be exported. */
async function bake(img: HTMLImageElement, s: Settings): Promise<string | null> {
  if (!img.crossOrigin) return null;
  const w = Math.max(16, Math.ceil(innerWidth / SCALE));
  const h = Math.max(16, Math.ceil(innerHeight / SCALE));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const blur = s.blur / SCALE;
  ctx.filter = `blur(${blur}px) brightness(${s.brightness / 100}) saturate(${s.saturation / 100}) contrast(${s.contrast / 100})`;
  // "cover" crop, overscanned by 2× the blur so the edges don't fade to transparent.
  const bleed = blur * 2;
  const scale = Math.max((w + bleed * 2) / img.naturalWidth, (h + bleed * 2) / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);

  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

// The image currently shown, for other windows (picture-in-picture) to reuse
// instead of baking their own. live = un-baked, needs the CSS filter.
export type BackgroundImage = { url: string; live: boolean } | null;
let shown: BackgroundImage = null;
const backgroundListeners = new Set<(image: BackgroundImage) => void>();

export const currentBackground = () => shown;

export function onBackgroundChange(listener: (image: BackgroundImage) => void) {
  backgroundListeners.add(listener);
  return () => void backgroundListeners.delete(listener);
}

function announce(image: BackgroundImage) {
  shown = image;
  backgroundListeners.forEach((l) => l(image));
}

function paint(layer: HTMLElement, url: string, live: boolean) {
  const old = layerUrls.get(layer);
  layer.style.setProperty("--ghost-art", `url("${url}")`);
  layer.classList.toggle("ghost-bg__layer--live", live);
  layerUrls.set(layer, url);
  // Free the previous baked image once nothing can still be showing it.
  if (old?.startsWith("blob:") && old !== url) setTimeout(() => URL.revokeObjectURL(old), 3000);
}

async function updateImage() {
  const src = wantedImage(getSettings());
  if (src === lastImage) return;
  lastImage = src;

  if (!src) {
    shownImage = null;
    layers.forEach((l) => l.classList.remove("ghost-active"));
    announce(null);
    return;
  }
  let img: HTMLImageElement;
  try {
    // CORS first (so it can be baked); custom URLs without CORS fail that way,
    // so retry plainly and use the live CSS filter for those.
    img = await loadImage(src, true).catch(() => loadImage(src, false));
    lastError = "";
  } catch {
    lastError = `failed to load ${src}`;
    lastImage = ""; // allow a retry on the next song / settings change
    return;
  }
  if (src !== lastImage) return; // something newer arrived while loading

  const baked = await bake(img, getSettings());
  if (src !== lastImage) return;
  shownImage = img;

  const next = layers[1 - active];
  paint(next, baked ?? src, !baked);
  next.classList.add("ghost-active");
  layers[active].classList.remove("ghost-active");
  active = 1 - active;
  announce({ url: baked ?? src, live: !baked });
}

/** Re-bake the current image in place (blur/colour sliders, window size). */
async function rebake() {
  const img = shownImage;
  if (!img) return;
  const baked = await bake(img, getSettings());
  if (baked && img === shownImage) {
    paint(layers[active], baked, false);
    announce({ url: baked, live: false });
  }
}

// --- fade time -----------------------------------------------------------------

// Match the background crossfade to Spotify's own crossfade setting (like Hazy).
// PlayerAPI._prefs is internal, so fall back to the CSS default on any failure.
// Re-read at most once a minute rather than on every song (two requests each).
const FADE_TTL = 60_000;
let fadeReadAt = 0;

async function syncFadeTime() {
  if (Date.now() - fadeReadAt < FADE_TTL) return;
  fadeReadAt = Date.now();
  const prefs = platform().PlayerAPI?._prefs;
  try {
    if (!prefs) throw 0;
    const on = await prefs.get({ key: "audio.crossfade_v2" });
    if (!on.entries["audio.crossfade_v2"]?.bool) throw 0;
    const time = await prefs.get({ key: "audio.crossfade.time_v2" });
    const ms = time.entries["audio.crossfade.time_v2"]?.number;
    if (!ms) throw 0;
    document.documentElement.style.setProperty("--ghost-fade", `${ms}ms`);
  } catch {
    document.documentElement.style.removeProperty("--ghost-fade");
  }
}

// --- init ----------------------------------------------------------------------

export function initBackground() {
  const bg = document.createElement("div");
  bg.id = "ghost-bg";
  bg.setAttribute("aria-hidden", "true");
  layers = [document.createElement("div"), document.createElement("div")];
  for (const layer of layers) {
    layer.className = "ghost-bg__layer";
    bg.append(layer);
  }
  document.body.prepend(bg);

  onSongChange(() => {
    updateImage();
    syncFadeTime();
  });

  // Source settings → reload; filter settings → re-bake (debounced, since
  // sliders fire continuously); window size → re-bake for the new aspect ratio.
  let rebakeTimer: number | undefined;
  const rebakeSoon = (delay: number) => {
    clearTimeout(rebakeTimer);
    rebakeTimer = window.setTimeout(rebake, delay);
  };

  watchSettings((s) => [s.bgSource, s.bgImageUrl], updateImage);
  watchSettings((s) => [s.blur, s.brightness, s.saturation, s.contrast], () => rebakeSoon(60));
  window.addEventListener("resize", () => rebakeSoon(300));
}
