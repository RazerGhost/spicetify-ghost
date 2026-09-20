// Lyrics sources, tried in order: AMLL (community word-synced TTML, keyed by
// Spotify track id) → Spotify's own lyrics → LRCLIB (open LRC database).
// No third-party service receives any Spotify token: Spotify's endpoint goes
// through Spicetify.CosmosAsync (Spotify's own auth), the others are public.

import { platform } from "../platform";
import { parseLRC, parseTTML, staticLyrics } from "./parse";
import type { Line, Lyrics, TrackInfo } from "./types";

const AMLL = "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/main/spotify-lyrics";
const SPOTIFY = "https://spclient.wg.spotify.com/color-lyrics/v2";
const LRCLIB = "https://lrclib.net/api";
const LRCLIB_HEADERS = { "Lrclib-Client": "Ghost (https://github.com/RazerGhost/spicetify-ghost)" };

/** Per request: a hanging provider must not keep "Loading lyrics…" up forever. */
const TIMEOUT = 8000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${TIMEOUT} ms`)), TIMEOUT)),
  ]);
}

const get = (url: string, headers?: Record<string, string>) => fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT) });

async function fromAmll(track: TrackInfo): Promise<Lyrics | null> {
  if (!track.id) return null;
  const res = await get(`${AMLL}/${encodeURIComponent(track.id)}.ttml`);
  if (!res.ok) return null; // 404 = not in the database
  return parseTTML(await res.text());
}

// Same request Spotify's own lyrics page makes (xpui-modules.js): through its
// RequestBuilder, with the cover image in the path. Spicetify.CosmosAsync can't
// route https://spclient URLs in current builds ("Resolver not found!"), so
// that's only a fallback for older ones.
async function requestSpotifyLyrics(track: TrackInfo): Promise<any> {
  const builder = platform().RequestBuilder;
  if (builder?.build) {
    try {
      const res = await withTimeout(
        builder
          .build()
          .withHost(SPOTIFY)
          .withPath(`/track/${encodeURIComponent(track.id!)}/image/${encodeURIComponent(track.image ?? "")}`)
          .withQueryParameters({ format: "json", vocalRemoval: false })
          .withEndpointIdentifier("/track/{trackId}")
          .send(),
      );
      return res?.body;
    } catch (err: any) {
      if (err?.status === 404) return null; // no lyrics for this track
      throw err;
    }
  }
  return withTimeout(Spicetify.CosmosAsync.get(`${SPOTIFY}/track/${track.id}?format=json&vocalRemoval=false&market=from_token`));
}

async function fromSpotify(track: TrackInfo): Promise<Lyrics | null> {
  if (!track.id) return null;
  const body = await requestSpotifyLyrics(track);
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
  const exact = await get(`${LRCLIB}/get?${params}`, LRCLIB_HEADERS);
  if (exact.ok) record = await exact.json();
  else {
    // Fall back to a search (album names often differ between services).
    const search = new URLSearchParams({ track_name: track.title, artist_name: track.artist });
    const res = await get(`${LRCLIB}/search?${search}`, LRCLIB_HEADERS);
    const results: (LrclibRecord & { duration?: number })[] = res.ok ? await res.json() : [];
    // Only accept a result of about the same length — anything else is likely a
    // different song or version. Unknown track length: trust the ranking.
    const close = results.filter((r) => !track.duration || Math.abs((r.duration ?? 0) - track.duration) < 3);
    record = close.find((r) => r.syncedLyrics) ?? close[0] ?? null;
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
/** How many of the first providers are started together. */
const EAGER = 2;

// --- cache + public API ----------------------------------------------------------

const cache = new Map<string, Promise<Lyrics | null>>();
const CACHE_LIMIT = 50;

/** `errored` = some provider threw (offline, server error) rather than cleanly
 *  finding nothing — such a miss shouldn't be cached. */
async function resolve(track: TrackInfo): Promise<{ lyrics: Lyrics | null; errored: boolean }> {
  let errored = false;
  const attempt = ([name, provider]: (typeof PROVIDERS)[number]) =>
    provider(track).catch((err) => {
      errored = true;
      console.warn(`[ghost] lyrics provider "${name}" failed`, err);
      return null;
    });
  // AMLL and Spotify are asked at once (AMLL still wins); LRCLIB, a shared
  // public service, only when both have nothing.
  const eager = PROVIDERS.slice(0, EAGER).map(attempt);
  for (let i = 0; i < PROVIDERS.length; i++) {
    const lyrics = await (eager[i] ?? attempt(PROVIDERS[i]));
    if (lyrics) return { lyrics, errored };
  }
  return { lyrics: null, errored };
}

/** Lyrics for a track (cached per session); null when no provider has any.
 *  Clean misses are cached too — otherwise every remount (the now-playing card
 *  re-renders often) re-ran the whole provider chain for songs without lyrics. */
export function getLyrics(track: TrackInfo): Promise<Lyrics | null> {
  let pending = cache.get(track.uri);
  if (!pending) {
    const result = resolve(track);
    pending = result.then((r) => r.lyrics);
    cache.set(track.uri, pending);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    result.then((r) => r.errored && !r.lyrics && cache.delete(track.uri));
  }
  return pending;
}
