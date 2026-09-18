// Lyrics sources, tried in order: AMLL (community word-synced TTML, keyed by
// Spotify track id) → Spotify's own lyrics → LRCLIB (open LRC database).
// No third-party service receives any Spotify token: Spotify's endpoint goes
// through Spicetify.CosmosAsync (Spotify's own auth), the others are public.

import { parseLRC, parseTTML, staticLyrics } from "./parse";
import type { Line, Lyrics, TrackInfo } from "./types";

const AMLL = "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/main/spotify-lyrics";
const SPOTIFY = "https://spclient.wg.spotify.com/color-lyrics/v2/track";
const LRCLIB = "https://lrclib.net/api";
const LRCLIB_HEADERS = { "Lrclib-Client": "Ghost (https://github.com/RazerGhost/spicetify-ghost)" };

async function fromAmll(track: TrackInfo): Promise<Lyrics | null> {
  if (!track.id) return null;
  const res = await fetch(`${AMLL}/${encodeURIComponent(track.id)}.ttml`);
  if (!res.ok) return null; // 404 = not in the database
  return parseTTML(await res.text());
}

async function fromSpotify(track: TrackInfo): Promise<Lyrics | null> {
  if (!track.id) return null;
  const body = await Spicetify.CosmosAsync.get(
    `${SPOTIFY}/${track.id}?format=json&vocalRemoval=false&market=from_token`,
  );
  const lyrics = body?.lyrics;
  if (!lyrics?.lines?.length) return null;

  const raw: { startTimeMs: string; endTimeMs: string; words: string }[] = lyrics.lines;
  if (lyrics.syncType !== "LINE_SYNCED") {
    return staticLyrics(raw.map((l) => l.words).join("\n"), "spotify");
  }
  const lines: Line[] = raw.map((l, i) => {
    const start = Number(l.startTimeMs) / 1000;
    const end = Number(l.endTimeMs) / 1000 || Number(raw[i + 1]?.startTimeMs ?? 0) / 1000 || start + 5;
    // Spotify marks instrumental breaks with a lone "♪"; the renderer shows
    // its own interlude dots for gaps, so drop them.
    return { text: l.words === "♪" ? "" : l.words, start, end };
  });
  return { kind: "line", provider: "spotify", lines: lines.filter((l) => l.text) };
}

type LrclibRecord = { syncedLyrics?: string | null; plainLyrics?: string | null; instrumental?: boolean };

async function fromLrclib(track: TrackInfo): Promise<Lyrics | null> {
  const params = new URLSearchParams({
    track_name: track.title,
    artist_name: track.artist,
    album_name: track.album,
    duration: String(Math.round(track.duration)),
  });
  let record: LrclibRecord | null = null;
  const exact = await fetch(`${LRCLIB}/get?${params}`, { headers: LRCLIB_HEADERS });
  if (exact.ok) record = await exact.json();
  else {
    // Fall back to a search (album names often differ between services).
    const search = new URLSearchParams({ track_name: track.title, artist_name: track.artist });
    const res = await fetch(`${LRCLIB}/search?${search}`, { headers: LRCLIB_HEADERS });
    const results: (LrclibRecord & { duration?: number })[] = res.ok ? await res.json() : [];
    record = results.find((r) => r.syncedLyrics && Math.abs((r.duration ?? 0) - track.duration) < 3) ?? results[0] ?? null;
  }
  if (!record) return null;
  if (record.instrumental) return { kind: "static", provider: "lrclib", lines: [] };
  if (record.syncedLyrics) return parseLRC(record.syncedLyrics, track.duration);
  if (record.plainLyrics) return staticLyrics(record.plainLyrics, "lrclib");
  return null;
}

// Explicit names: function names don't survive minification.
const PROVIDERS: [string, (track: TrackInfo) => Promise<Lyrics | null>][] = [
  ["amll", fromAmll],
  ["spotify", fromSpotify],
  ["lrclib", fromLrclib],
];

// --- cache + public API ----------------------------------------------------------

const cache = new Map<string, Promise<Lyrics | null>>();
const CACHE_LIMIT = 50;

async function resolve(track: TrackInfo): Promise<Lyrics | null> {
  for (const [name, provider] of PROVIDERS) {
    try {
      const lyrics = await provider(track);
      if (lyrics) return lyrics;
    } catch (err) {
      console.warn(`[ghost] lyrics provider "${name}" failed`, err);
    }
  }
  return null;
}

/** Lyrics for a track (cached per session); null when no provider has any. */
export function getLyrics(track: TrackInfo): Promise<Lyrics | null> {
  let pending = cache.get(track.uri);
  if (!pending) {
    pending = resolve(track);
    cache.set(track.uri, pending);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    // Don't cache failures caused by being offline etc. — retry next time.
    pending.then((l) => l === null && cache.delete(track.uri));
  }
  return pending;
}

/** Current track from Spicetify.Player, in the shape providers need. */
export function currentTrack(): TrackInfo | null {
  const item = Spicetify.Player.data?.item as any;
  if (!item?.uri) return null;
  const meta = item.metadata ?? {};
  const isTrack = item.uri.startsWith("spotify:track:");
  return {
    uri: item.uri,
    id: isTrack ? item.uri.split(":")[2] : undefined,
    title: item.name ?? meta.title ?? "",
    artist: item.artists?.[0]?.name ?? meta.artist_name ?? "",
    album: item.album?.name ?? meta.album_title ?? "",
    duration: (item.duration?.milliseconds ?? Number(meta.duration) ?? 0) / 1000,
  };
}
