// Background: two stacked layers that crossfade whenever the image changes.
// Source is the current album art, a custom image URL, or nothing (solid colour).
// All blur / brightness / animation is done in CSS (see #ghost-bg in user.css);
// this file only swaps image URLs, derives the accent colour and syncs fade time.

import { getSettings, subscribe, type Settings } from "./settings/store";

let layers: [HTMLElement, HTMLElement];
let active = 0;
let lastImage = "";

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
function albumArt(): string | undefined {
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

function preload(src: string) {
  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

async function updateImage() {
  const src = wantedImage(getSettings());
  if (src === lastImage) return;
  lastImage = src;

  if (!src) {
    layers.forEach((l) => l.classList.remove("ghost-active"));
    return;
  }
  try {
    await preload(src);
    lastError = "";
  } catch {
    lastError = `failed to load ${src}`;
    lastImage = ""; // allow a retry on the next song / settings change
    return;
  }
  if (src !== lastImage) return; // something newer arrived while loading

  const next = layers[1 - active];
  next.style.setProperty("--ghost-art", `url("${src}")`);
  next.classList.add("ghost-active");
  layers[active].classList.remove("ghost-active");
  active = 1 - active;
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

async function artAccent(): Promise<string | undefined> {
  const uri = Spicetify.Player.data?.item?.uri;
  if (!uri) return undefined;
  try {
    const colors = await Spicetify.colorExtractor(uri);
    return [colors.VIBRANT_NON_ALARMING, colors.VIBRANT, colors.LIGHT_VIBRANT, colors.PROMINENT].find((hex) => {
      const rgb = hexToRgb(hex ?? "");
      return rgb && luminance(rgb) > 0.12 && luminance(rgb) < 0.85;
    });
  } catch {
    return undefined;
  }
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

  // Re-run only when a setting that affects image/accent changed.
  const key = (s: Settings) => [s.bgSource, s.bgImageUrl, s.accentSource, s.accentColor].join("|");
  let last = key(getSettings());
  subscribe(() => {
    const next = key(getSettings());
    if (next === last) return;
    last = next;
    updateImage();
    updateAccent();
  });
}
