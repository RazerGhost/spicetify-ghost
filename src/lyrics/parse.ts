// Parsers for TTML (AMLL) and LRC (LRCLIB). Written for Ghost; uses the browser's
// DOMParser instead of an XML library.

import type { Line, Lyrics, Vocal, Word } from "./types";

// --- time --------------------------------------------------------------------

/** "hh:mm:ss.fff" | "mm:ss.fff" | "ss.fff" | "12.3s" → seconds. */
export function parseTime(value: string | null | undefined): number {
  if (!value) return 0;
  const v = value.trim();
  if (v.endsWith("s") && !v.includes(":")) return parseFloat(v);
  const parts = v.split(":").map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

// --- TTML (AMLL TTML DB) -------------------------------------------------------
//
// <tt><body><div>
//   <p begin end ttm:agent="v1">
//     <span begin end>Word</span><span begin end> word</span>
//     <span ttm:role="x-bg"><span begin end>(echo)</span></span>
//   </p>

const TTM = "http://www.w3.org/ns/ttml#metadata";

function roleOf(el: Element): string | null {
  return el.getAttributeNS(TTM, "role") ?? el.getAttribute("ttm:role");
}

function agentOf(el: Element): string | null {
  return el.getAttributeNS(TTM, "agent") ?? el.getAttribute("ttm:agent");
}

/** Timed spans directly under `parent` → words. Whitespace between spans is kept
 *  on the preceding word so spacing survives. */
function collectWords(parent: Element): Word[] {
  const words: Word[] = [];
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (words.length && /\s/.test(node.textContent ?? "")) words[words.length - 1].text += " ";
      continue;
    }
    if (!(node instanceof Element) || node.localName !== "span" || roleOf(node)) continue;
    if (!node.hasAttribute("begin")) continue;
    words.push({
      text: node.textContent ?? "",
      start: parseTime(node.getAttribute("begin")),
      end: parseTime(node.getAttribute("end")),
    });
  }
  return words;
}

function vocalFrom(words: Word[], fallbackText: string): Vocal {
  const text = words.length ? words.map((w) => w.text).join("").trim() : fallbackText.trim();
  return words.length ? { text, words } : { text };
}

export function parseTTML(xml: string): Lyrics | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return null;

  const paragraphs = Array.from(doc.getElementsByTagName("p"));
  if (!paragraphs.length) return null;

  // Duets: the first agent is "main"; any other agent sings on the opposite side.
  const mainAgent = agentOf(paragraphs[0]);
  let hasWordTiming = false;

  const lines: Line[] = paragraphs.map((p) => {
    const words = collectWords(p);
    if (words.length) hasWordTiming = true;

    const bgSpan = Array.from(p.children).find((c) => roleOf(c) === "x-bg");
    const bgWords = bgSpan ? collectWords(bgSpan) : [];
    const line: Line = {
      ...vocalFrom(words, words.length ? "" : textWithoutBackground(p)),
      start: parseTime(p.getAttribute("begin")),
      end: parseTime(p.getAttribute("end")),
    };
    if (bgSpan) line.background = vocalFrom(bgWords, bgSpan.textContent ?? "");
    const agent = agentOf(p);
    if (agent && mainAgent && agent !== mainAgent) line.opposite = true;
    return line;
  });

  return { kind: hasWordTiming ? "word" : "line", provider: "amll", lines };
}

function textWithoutBackground(p: Element): string {
  const clone = p.cloneNode(true) as Element;
  for (const bg of Array.from(clone.children)) if (roleOf(bg) === "x-bg") bg.remove();
  return clone.textContent ?? "";
}

// --- LRC (LRCLIB) ----------------------------------------------------------------
//
// [00:12.34]Plain line
// [00:12.34]<00:12.34>Enhanced <00:12.80>word <00:13.10>timing

const LINE_TAG = /^\[(\d+:\d+(?:[.:]\d+)?)\]/;
const WORD_TAG = /<(\d+:\d+(?:[.:]\d+)?)>/g;

function lrcTime(tag: string): number {
  // LRC uses mm:ss.xx (sometimes mm:ss:xx).
  const [m, rest] = tag.split(/:(.*)/s);
  return Number(m) * 60 + Number(rest.replace(":", "."));
}

export function parseLRC(lrc: string, duration: number): Lyrics | null {
  const entries: { start: number; body: string }[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    let rest = raw.trim();
    const times: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = LINE_TAG.exec(rest))) {
      times.push(lrcTime(match[1]));
      rest = rest.slice(match[0].length);
    }
    for (const start of times) entries.push({ start, body: rest });
  }
  if (!entries.length) return null;
  entries.sort((a, b) => a.start - b.start);

  let hasWordTiming = false;
  const lines: Line[] = entries.map((entry, i) => {
    const end = entries[i + 1]?.start ?? Math.max(entry.start + 5, duration);
    const marks = [...entry.body.matchAll(WORD_TAG)];
    if (!marks.length) return { text: entry.body.trim(), start: entry.start, end };

    hasWordTiming = true;
    const words: Word[] = marks.map((m, j) => {
      const textStart = m.index! + m[0].length;
      const textEnd = marks[j + 1]?.index ?? entry.body.length;
      return {
        text: entry.body.slice(textStart, textEnd),
        start: lrcTime(m[1]),
        end: marks[j + 1] ? lrcTime(marks[j + 1][1]) : end,
      };
    });
    return { text: words.map((w) => w.text).join("").trim(), words, start: entry.start, end };
  });

  return { kind: hasWordTiming ? "word" : "line", provider: "lrclib", lines: lines.filter((l) => l.text || l.words) };
}

/** Plain, unsynced text → static lyrics. */
export function staticLyrics(text: string, provider: Lyrics["provider"]): Lyrics {
  const lines = text.split(/\r?\n/).map((t) => ({ text: t.trim(), start: 0, end: 0 }));
  return { kind: "static", provider, lines };
}
