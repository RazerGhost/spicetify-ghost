// Accent colour (Spotify's --spice-button / -active and everything derived from
// them): from the album art, a custom colour, or color.ini's ("theme").

import { albumArt, onSongChange } from "./player";
import { getSettings, watchSettings } from "./settings/store";

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
// After a few failures in a row, skip colorExtractor for the session — in builds
// where it's broken it fails every time, costing a request per song. (Not after
// one: that could be a passing network error.)
const EXTRACTOR_MAX_FAILURES = 3;
let extractorFailures = 0;

async function artColors(): Promise<string[]> {
  const uri = Spicetify.Player.data?.item?.uri;
  if (!uri) return [];
  if (extractorFailures < EXTRACTOR_MAX_FAILURES) {
    try {
      const c = await Spicetify.colorExtractor(uri);
      extractorFailures = 0;
      if (c) return [c.VIBRANT_NON_ALARMING, c.VIBRANT, c.LIGHT_VIBRANT, c.PROMINENT];
    } catch {
      extractorFailures++;
    }
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
  const uri = Spicetify.Player.data?.item?.uri;
  const accent = await artAccent();
  // A newer song or setting change may have landed while the colours loaded.
  if (uri !== Spicetify.Player.data?.item?.uri || getSettings().accentSource !== "art") return;
  setAccent(accent);
}

export function initAccent() {
  onSongChange(updateAccent);
  watchSettings((s) => [s.accentSource, s.accentColor], updateAccent);
}
