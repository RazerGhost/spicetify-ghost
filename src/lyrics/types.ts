// Normalised lyrics model shared by all providers. Times are in seconds.

export type Word = {
  text: string;
  start: number;
  end: number;
};

export type Vocal = {
  text: string;
  /** Present when the provider has per-word timing (AMLL TTML, enhanced LRC). */
  words?: Word[];
};

export type Line = Vocal & {
  start: number;
  end: number;
  /** Background vocals sung over this line (AMLL "x-bg"). */
  background?: Vocal;
  /** Sung by the second singer in a duet — rendered on the opposite side. */
  opposite?: boolean;
};

export type LyricsKind = "word" | "line" | "static";

export type Provider = "amll" | "spotify" | "lrclib";

export type Lyrics = {
  kind: LyricsKind;
  provider: Provider;
  lines: Line[];
};

/** What providers need to know about the track. */
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
