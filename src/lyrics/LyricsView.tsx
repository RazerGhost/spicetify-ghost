// Synced lyrics renderer.
//
// React renders the structure once per song; everything that changes per frame
// (which line is active, word fill, interlude dots, blur distance, scrolling) is
// written straight to the DOM from a requestAnimationFrame loop. That keeps it
// smooth without re-rendering React 60 times a second.

import { useEffect, useMemo, useRef } from "react";
import { useRomanized } from "./romanize";
import type { Line, Lyrics, Vocal } from "./types";

type Item =
  | { type: "line"; start: number; end: number; line: Line }
  | { type: "interlude"; start: number; end: number };

/** Gaps at least this long (seconds) get interlude dots. */
const INTERLUDE_MIN = 4;
/** Small lookahead so highlights don't feel late. */
const LOOKAHEAD = 0.05;
/** Pause auto-scroll this long after the user scrolls. */
const USER_SCROLL_PAUSE = 4000;

export type LyricsVariant = "page" | "card" | "fullscreen" | "pip";

/** Where the current line sits, as a fraction of the scroller's height. */
const ANCHOR: Record<LyricsVariant, number> = { page: 0.35, card: 0.4, fullscreen: 0.4, pip: 0.4 };

function buildItems(lyrics: Lyrics): Item[] {
  const items: Item[] = [];
  let previousEnd = 0;
  for (const line of lyrics.lines) {
    if (line.start - previousEnd >= INTERLUDE_MIN) {
      items.push({ type: "interlude", start: previousEnd, end: line.start });
    }
    items.push({ type: "line", start: line.start, end: line.end, line });
    previousEnd = Math.max(previousEnd, line.end);
  }
  return items;
}

function VocalText({ vocal, className }: { vocal: Vocal; className: string }) {
  if (!vocal.words) return <span className={className}>{vocal.text}</span>;
  return (
    <span className={className}>
      {vocal.words.map((w, i) => (
        <span key={i} className="ghost-lyrics__word" data-start={w.start} data-end={w.end}>
          {w.text}
        </span>
      ))}
    </span>
  );
}

function seek(seconds: number) {
  Spicetify.Player.seek(Math.max(0, Math.round(seconds * 1000)));
}

export function LyricsView({ lyrics, variant = "page" }: { lyrics: Lyrics; variant?: LyricsVariant }) {
  const scroller = useRef<HTMLDivElement>(null);
  const items = useMemo(() => buildItems(lyrics), [lyrics]);
  const synced = lyrics.kind !== "static";
  // Adds spans inside existing lines when ready; the frame loop below doesn't
  // depend on it, so it keeps running undisturbed.
  const romanized = useRomanized(lyrics);

  useEffect(() => {
    const root = scroller.current;
    if (!root || !synced) return;
    // The window this view lives in — the picture-in-picture window for the PiP
    // view. Its rAF keeps running when Spotify's main window is minimised (the
    // main window's doesn't), and its IntersectionObserver sees its own viewport.
    const win = (root.ownerDocument.defaultView ?? window) as Window & typeof globalThis;

    const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-item]"));
    const states: string[] = elements.map(() => "");
    const wordsOf = new Map<HTMLElement, HTMLElement[]>();
    // Last written --ghost-p per element, so unchanged values aren't re-written.
    const written = new Map<HTMLElement, string>();
    let current = -2;
    let userScrollAt = 0;
    let programmatic = false;
    let frame = 0;
    let lastTime = -1;
    let visible = true;

    const setProgress = (el: HTMLElement, value: number) => {
      const v = value.toFixed(3);
      if (written.get(el) === v) return;
      written.set(el, v);
      el.style.setProperty("--ghost-p", v);
    };

    // Stop the loop entirely while the view is off-screen or hidden (card
    // scrolled away, everything under fullscreen), restart when it's back.
    const io = new win.IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = win.requestAnimationFrame(tick);
    });
    io.observe(root);

    const onUserScroll = () => {
      if (!programmatic) userScrollAt = Date.now();
    };
    root.addEventListener("wheel", onUserScroll, { passive: true });
    root.addEventListener("touchmove", onUserScroll, { passive: true });
    root.addEventListener("keydown", onUserScroll);

    const scrollTo = (el: HTMLElement, smooth: boolean) => {
      programmatic = true;
      root.scrollTo({ top: el.offsetTop - root.clientHeight * ANCHOR[variant], behavior: smooth ? "smooth" : "auto" });
      win.setTimeout(() => (programmatic = false), 600);
    };

    function tick() {
      if (!visible) {
        frame = 0;
        return;
      }
      frame = win.requestAnimationFrame(tick);
      const t = Spicetify.Player.getProgress() / 1000 + LOOKAHEAD;
      if (t === lastTime) return; // paused: nothing moves
      lastTime = t;

      // Current = last item that has started.
      let next = -1;
      for (let i = 0; i < items.length && items[i].start <= t; i++) next = i;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const el = elements[i];
        const state = t < item.start ? "future" : t < item.end ? "active" : "past";
        if (state !== states[i]) {
          states[i] = state;
          el.dataset.state = state;
        }
        if (state === "active") {
          if (item.type === "interlude") {
            setProgress(el, (t - item.start) / (item.end - item.start));
          } else if (item.line.words || item.line.background?.words) {
            let words = wordsOf.get(el);
            if (!words) wordsOf.set(el, (words = Array.from(el.querySelectorAll<HTMLElement>(".ghost-lyrics__word"))));
            for (const w of words) {
              const start = Number(w.dataset.start);
              const end = Number(w.dataset.end);
              setProgress(w, end > start ? Math.min(1, Math.max(0, (t - start) / (end - start))) : t >= start ? 1 : 0);
            }
          }
        }
      }

      if (next !== current) {
        const first = current === -2;
        current = next;
        elements.forEach((el, i) => el.style.setProperty("--ghost-d", String(Math.min(5, Math.abs(i - Math.max(0, next))))));
        const target = elements[Math.max(0, next)];
        if (target && Date.now() - userScrollAt > USER_SCROLL_PAUSE) scrollTo(target, !first);
      }
    }
    tick();

    return () => {
      io.disconnect();
      win.cancelAnimationFrame(frame);
      root.removeEventListener("wheel", onUserScroll);
      root.removeEventListener("touchmove", onUserScroll);
      root.removeEventListener("keydown", onUserScroll);
    };
  }, [items, synced, variant]);

  return (
    <div ref={scroller} className={`ghost-lyrics ghost-lyrics--${lyrics.kind} ghost-lyrics--${variant}`} tabIndex={0}>
      {items.map((item, i) =>
        item.type === "interlude" ? (
          <div key={i} data-item className="ghost-lyrics__interlude" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div
            key={i}
            data-item
            className={`ghost-lyrics__line${item.line.opposite ? " ghost-lyrics__line--opposite" : ""}`}
            onClick={synced ? () => seek(item.start) : undefined}
          >
            <VocalText vocal={item.line} className="ghost-lyrics__main" />
            {romanized?.has(item.line) && <span className="ghost-lyrics__roman">{romanized.get(item.line)}</span>}
            {item.line.background && <VocalText vocal={item.line.background} className="ghost-lyrics__bg" />}
          </div>
        ),
      )}
      <div className="ghost-lyrics__credit">Lyrics: {PROVIDER_NAMES[lyrics.provider]}</div>
    </div>
  );
}

const PROVIDER_NAMES: Record<Lyrics["provider"], string> = {
  amll: "AMLL TTML DB",
  spotify: "Spotify",
  lrclib: "LRCLIB",
};
