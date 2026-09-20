// Romanization for lyrics: which lines get a romanized line under them, and in
// which script. Korean is built in; Japanese and Chinese load their libraries on
// demand (see japanese.ts / chinese.ts). Results are cached per song + options.

import { useEffect, useState, useSyncExternalStore } from "react";
import { getSettings, subscribe } from "../../settings/store";
import type { Line, Lyrics } from "../types";
import { hasHan, romanizeChinese } from "./chinese";
import { hasJapanese, hasKana, romanizeJapanese } from "./japanese";
import { hasHangul, romanizeKorean } from "./korean";

type Options = { japanese: boolean; chinese: boolean };
type Romanized = Map<Line, string>;

/** `complete` is false when a romanizer failed (e.g. its library couldn't
 *  download) — such a result is shown but not cached, so it's retried. */
async function romanize(lyrics: Lyrics, options: Options): Promise<{ result: Romanized; complete: boolean }> {
  const result: Romanized = new Map();
  let complete = true;
  // Kanji and hanzi share code points: if the song has any kana, its kanji
  // lines are Japanese; otherwise lines with hanzi are Chinese.
  const japaneseSong = lyrics.lines.some((l) => hasKana(l.text));
  const japanese: Line[] = [];
  const chinese: Line[] = [];

  for (const line of lyrics.lines) {
    const text = line.text;
    if (!text) continue;
    if (hasHangul(text)) result.set(line, romanizeKorean(text));
    else if (japaneseSong && hasJapanese(text)) japanese.push(line);
    else if (hasHan(text)) chinese.push(line);
  }

  const fill = async (lines: Line[], run: (texts: string[]) => Promise<string[]>, what: string) => {
    if (!lines.length) return;
    try {
      const out = await run(lines.map((l) => l.text));
      out.forEach((r, i) => result.set(lines[i], r));
    } catch (err) {
      complete = false;
      console.warn(`[ghost] ${what} romanization unavailable`, err);
    }
  };
  if (options.japanese) await fill(japanese, romanizeJapanese, "Japanese");
  if (options.chinese) await fill(chinese, romanizeChinese, "Chinese");

  // Nothing to show when romanizing changed nothing (e.g. English lines).
  for (const [line, roman] of result) if (roman.trim() === line.text.trim()) result.delete(line);
  return { result, complete };
}

const cache = new WeakMap<Lyrics, Map<string, Promise<Romanized>>>();

function romanizeCached(lyrics: Lyrics, options: Options): Promise<Romanized> {
  let perOptions = cache.get(lyrics);
  if (!perOptions) cache.set(lyrics, (perOptions = new Map()));
  const key = `${options.japanese}|${options.chinese}`;
  let pending = perOptions.get(key);
  if (!pending) {
    const run = romanize(lyrics, options);
    perOptions.set(key, (pending = run.then((r) => r.result)));
    const entries = perOptions;
    run.then((r) => !r.complete && entries.delete(key));
  }
  return pending;
}

/** Romanized text per line, or null when romanization is off / not ready yet. */
export function useRomanized(lyrics: Lyrics): Romanized | null {
  // A string snapshot so useSyncExternalStore sees a stable value.
  const key = useSyncExternalStore(subscribe, () => {
    const s = getSettings();
    return `${s.romanize}|${s.romanizeJapanese}|${s.romanizeChinese}`;
  });
  const [romanized, setRomanized] = useState<Romanized | null>(null);

  useEffect(() => {
    const s = getSettings();
    if (!s.romanize || lyrics.kind === "static") return setRomanized(null);
    let cancelled = false;
    romanizeCached(lyrics, { japanese: s.romanizeJapanese, chinese: s.romanizeChinese }).then((r) => {
      if (!cancelled) setRomanized(r.size ? r : null);
    });
    return () => {
      cancelled = true;
    };
  }, [lyrics, key]);

  return romanized;
}
