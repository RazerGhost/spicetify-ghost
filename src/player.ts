// What's playing: the current track and its cover art, read from
// Spicetify.Player. Shared by the background (art, accent) and the lyrics.

/** The current track, as the lyrics code needs it. */
export type TrackInfo = {
  uri: string;
  /** Spotify track id; undefined for local files. */
  id?: string;
  title: string;
  artist: string;
  album: string;
  /** Seconds. */
  duration: number;
  /** Cover image URL — Spotify's lyrics endpoint wants it in the path. */
  image?: string;
};

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

/** Current track from Spicetify.Player; null while nothing is loaded. */
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
    duration: (item.duration?.milliseconds || Number(meta.duration) || 0) / 1000,
    image: albumArt(),
  };
}

/** Run `cb` on every song change, and once as soon as the first track is known.
 *  On startup Player.data is often still empty and no songchange fires until the
 *  next track, so that first run waits (max ~10 s) for the current item. */
export function onSongChange(cb: () => void) {
  Spicetify.Player.addEventListener("songchange", cb);
  (async () => {
    for (let i = 0; i < 40 && !Spicetify.Player.data?.item; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    cb();
  })();
}
