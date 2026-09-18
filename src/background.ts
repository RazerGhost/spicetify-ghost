// Background: two stacked layers that crossfade whenever the image changes.
// Source is the current album art, a custom image URL, or nothing (solid colour).
//
// Performance: the image is blurred ONCE per song into a small canvas (1/SCALE of
// the window, with brightness/saturation/contrast baked in) and shown stretched.
// A live CSS `filter: blur()` on two full-window layers made Chromium redo a large
// blur on every redrawn frame — i.e. during every page change and scroll.
// i.scdn.co sends Access-Control-Allow-Origin: *, so covers can be exported from
// the canvas. Custom images without CORS fall back to the live CSS filter
// (.ghost-bg__layer--live in user.css).

import { getSettings, subscribe, type Settings } from "./settings/store";

/** Canvas is rendered at 1/SCALE of the window and upscaled; invisible after a heavy blur. */
const SCALE = 8;

let layers: [HTMLElement, HTMLElement];
let active = 0;
let lastImage = "";
/** Decoded image currently shown — kept so filter/size changes can re-render it. */
let shownImage: HTMLImageElement | null = null;
const layerUrls = new WeakMap<HTMLElement, string>();

function toHttps(url: string | undefined): string | undefined {
  // Player metadata gives "spotify:image:<id>"; the CDN serves the same id.
  if (!url) return undefined;
  return url.startsWith("spotify:image:")
    ? `https://i.scdn.co/image/${url.slice("spotify:image:".length)}`
    : url;
}

const SIZE_ORDER = ["xlarge", "large", "standard", "default", "small"];

function largest(images: { url: string; label: string }[] | undefined): string | undefined {
  if (!images?.length) return undefined;
  const rank = (label: string) => {
    const i = SIZE_ORDER.indexOf(label);
    return i === -1 ? SIZE_ORDER.length : i;
  };
  return [...images].sort((a, b) => rank(a.label) - rank(b.label))[0]?.url;
}

// Metadata image fields first; some items (e.g. music videos) may only carry
// item.images / item.album.images, so fall back to those.
export function albumArt(): string | undefined {
  const item = Spicetify.Player.data?.item;
  const meta = item?.metadata;
  return toHttps(
    meta?.image_xlarge_url ||
      meta?.image_large_url ||
      meta?.image_url ||
      largest(item?.images) ||
      largest(item?.album?.images),
  );
}

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
}

/** Re-bake the current image in place (blur/colour sliders, window size). */
async function rebake() {
  const img = shownImage;
  if (!img) return;
  const baked = await bake(img, getSettings());
  if (baked && img === shownImage) paint(layers[active], baked, false);
}

// --- accent colour -------------------------------------------------------------

// Spotify's --essential-bright-accent / --text-bright-accent etc. point at these.
const ACCENT_VARS = ["button", "button-active"];

function hexToRgb(hex: string): [number, number, number] | undefined {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : undefined;
}

// Relative luminance (0 = black, 1 = white), used to skip unreadable accents.
function luminance([r, g, b]: [number, number, number]) {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function setAccent(hex: string | undefined) {
  const root = document.documentElement.style;
  const rgb = hex ? hexToRgb(hex) : undefined;
  for (const v of ACCENT_VARS) {
    if (hex && rgb) {
      root.setProperty(`--spice-${v}`, hex);
      root.setProperty(`--spice-rgb-${v}`, rgb.join(","));
    } else {
      root.removeProperty(`--spice-${v}`);
      root.removeProperty(`--spice-rgb-${v}`);
    }
  }
}

const readable = (hex: string | undefined) => {
  const rgb = hexToRgb(hex ?? "");
  return !!rgb && luminance(rgb) > 0.12 && luminance(rgb) < 0.85;
};

// Candidate colours from the album art, most vibrant first.
// 1. Spicetify.colorExtractor — goes through CosmosAsync to spclient, which
//    fails in current Spotify builds ("Resolver not found!").
// 2. The GraphQL query Spotify's own UI uses (fetchExtractedColors, exposed by
//    Spicetify in GraphQL.Definitions) for the cover image.
async function artColors(): Promise<string[]> {
  const uri = Spicetify.Player.data?.item?.uri;
  if (!uri) return [];
  try {
    const c = await Spicetify.colorExtractor(uri);
    if (c) return [c.VIBRANT_NON_ALARMING, c.VIBRANT, c.LIGHT_VIBRANT, c.PROMINENT];
  } catch {
    // fall through to GraphQL
  }
  const image = albumArt();
  const query = (Spicetify.GraphQL as any)?.Definitions?.fetchExtractedColors;
  if (!image || !query) return [];
  try {
    const res = await Spicetify.GraphQL.Request(query, { imageUris: [image] });
    const colors = res?.data?.extractedColors?.[0];
    return colors ? [colors.colorRaw?.hex, colors.colorLight?.hex, colors.colorDark?.hex] : [];
  } catch {
    return [];
  }
}

async function artAccent(): Promise<string | undefined> {
  return (await artColors()).find(readable);
}

async function updateAccent() {
  const s = getSettings();
  if (s.accentSource === "custom") return setAccent(s.accentColor);
  if (s.accentSource === "theme") return setAccent(undefined);
  setAccent(await artAccent());
}

// --- fade time -----------------------------------------------------------------

// Match the background crossfade to Spotify's own crossfade setting (like Hazy).
// PlayerAPI._prefs is internal, so fall back to the CSS default on any failure.
async function syncFadeTime() {
  const prefs = (Spicetify.Platform as any)?.PlayerAPI?._prefs;
  try {
    const on = await prefs.get({ key: "audio.crossfade_v2" });
    if (!on.entries["audio.crossfade_v2"].bool) throw 0;
    const time = await prefs.get({ key: "audio.crossfade.time_v2" });
    const ms = time.entries["audio.crossfade.time_v2"].number;
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

  const onSong = () => {
    updateImage();
    updateAccent();
    syncFadeTime();
  };
  Spicetify.Player.addEventListener("songchange", onSong);

  // On startup Player.data is often still empty and no songchange fires until the
  // next track, so poll briefly (max ~10s) for the current item before the first run.
  (async () => {
    for (let i = 0; i < 40 && !Spicetify.Player.data?.item; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    onSong();
  })();

  // Source/accent settings → reload; filter settings → re-bake (debounced, since
  // sliders fire continuously); window size → re-bake for the new aspect ratio.
  const sourceKey = (s: Settings) => [s.bgSource, s.bgImageUrl, s.accentSource, s.accentColor].join("|");
  const filterKey = (s: Settings) => [s.blur, s.brightness, s.saturation, s.contrast].join("|");
  let lastSource = sourceKey(getSettings());
  let lastFilter = filterKey(getSettings());
  let rebakeTimer: number | undefined;
  const rebakeSoon = (delay: number) => {
    clearTimeout(rebakeTimer);
    rebakeTimer = window.setTimeout(rebake, delay);
  };

  subscribe(() => {
    const s = getSettings();
    if (sourceKey(s) !== lastSource) {
      lastSource = sourceKey(s);
      updateImage();
      updateAccent();
    }
    if (filterKey(s) !== lastFilter) {
      lastFilter = filterKey(s);
      rebakeSoon(60);
    }
  });
  window.addEventListener("resize", () => rebakeSoon(300));
}
