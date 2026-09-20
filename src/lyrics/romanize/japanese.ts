// Japanese → Hepburn romaji. kuromoji (Apache-2.0) splits the text into words
// and gives each one's reading in katakana — that's what resolves kanji. It's
// loaded from jsDelivr only when Japanese romanization is on; its dictionary is
// ~17 MB of gzip files, cached by the browser (immutable) after the first time.
// Kana → romaji is a small table here.

import { loadGlobal } from "./load";

const KUROMOJI = "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js";
const DICT = "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/";

type Token = { surface_form: string; reading?: string; pos: string };
type Tokenizer = { tokenize(text: string): Token[] };
type Kuromoji = { builder(o: { dicPath: string }): { build(cb: (err: unknown, t: Tokenizer) => void): void } };

let tokenizer: Promise<Tokenizer> | null = null;

// kuromoji builds dictionary URLs with path.join, which turns "https://cdn…" into
// "https:/cdn…" — and a browser resolves that against the *page's* host. So while
// it loads, repair that prefix in XMLHttpRequest.open, then restore the original.
function withFixedUrls<T>(run: () => Promise<T>): Promise<T> {
  const proto = XMLHttpRequest.prototype;
  const open = proto.open;
  proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    const fixed = typeof url === "string" ? url.replace(/^(https?):\/(?!\/)/, "$1://") : url;
    return (open as (...args: unknown[]) => void).call(this, method, fixed, ...rest);
  } as typeof proto.open;
  return run().finally(() => {
    proto.open = open;
  });
}

function getTokenizer(): Promise<Tokenizer> {
  tokenizer ??= loadGlobal<Kuromoji>(KUROMOJI, "kuromoji").then((kuromoji) =>
    withFixedUrls(
      () =>
        new Promise<Tokenizer>((resolve, reject) =>
          kuromoji.builder({ dicPath: DICT }).build((err, t) => (err ? reject(err) : resolve(t))),
        ),
    ),
  );
  tokenizer.catch(() => (tokenizer = null)); // allow a retry
  return tokenizer;
}

// --- kana → romaji (Hepburn) -------------------------------------------------------

const BASE: Record<string, string> = {
  ア: "a", イ: "i", ウ: "u", エ: "e", オ: "o",
  カ: "ka", キ: "ki", ク: "ku", ケ: "ke", コ: "ko", ガ: "ga", ギ: "gi", グ: "gu", ゲ: "ge", ゴ: "go",
  サ: "sa", シ: "shi", ス: "su", セ: "se", ソ: "so", ザ: "za", ジ: "ji", ズ: "zu", ゼ: "ze", ゾ: "zo",
  タ: "ta", チ: "chi", ツ: "tsu", テ: "te", ト: "to", ダ: "da", ヂ: "ji", ヅ: "zu", デ: "de", ド: "do",
  ナ: "na", ニ: "ni", ヌ: "nu", ネ: "ne", ノ: "no",
  ハ: "ha", ヒ: "hi", フ: "fu", ヘ: "he", ホ: "ho", バ: "ba", ビ: "bi", ブ: "bu", ベ: "be", ボ: "bo",
  パ: "pa", ピ: "pi", プ: "pu", ペ: "pe", ポ: "po",
  マ: "ma", ミ: "mi", ム: "mu", メ: "me", モ: "mo",
  ヤ: "ya", ユ: "yu", ヨ: "yo",
  ラ: "ra", リ: "ri", ル: "ru", レ: "re", ロ: "ro",
  ワ: "wa", ヰ: "i", ヱ: "e", ヲ: "o", ン: "n", ヴ: "vu",
  ァ: "a", ィ: "i", ゥ: "u", ェ: "e", ォ: "o", ヮ: "wa",
};

// Consonant + small ya/yu/yo (and a few loanword combinations).
const COMBO: Record<string, string> = {
  キャ: "kya", キュ: "kyu", キョ: "kyo", ギャ: "gya", ギュ: "gyu", ギョ: "gyo",
  シャ: "sha", シュ: "shu", ショ: "sho", ジャ: "ja", ジュ: "ju", ジョ: "jo", シェ: "she", ジェ: "je",
  チャ: "cha", チュ: "chu", チョ: "cho", チェ: "che",
  ニャ: "nya", ニュ: "nyu", ニョ: "nyo", ヒャ: "hya", ヒュ: "hyu", ヒョ: "hyo",
  ビャ: "bya", ビュ: "byu", ビョ: "byo", ピャ: "pya", ピュ: "pyu", ピョ: "pyo",
  ミャ: "mya", ミュ: "myu", ミョ: "myo", リャ: "rya", リュ: "ryu", リョ: "ryo",
  ティ: "ti", ディ: "di", トゥ: "tu", ドゥ: "du", ファ: "fa", フィ: "fi", フェ: "fe", フォ: "fo",
  ウィ: "wi", ウェ: "we", ウォ: "wo", ヴァ: "va", ヴィ: "vi", ヴェ: "ve", ヴォ: "vo",
};

/** Hiragana → katakana (same layout, offset 0x60). */
const toKatakana = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

export function kanaToRomaji(input: string): string {
  const s = toKatakana(input);
  let out = "";
  let doubleNext = false; // after small ッ
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "ッ") {
      doubleNext = true;
      continue;
    }
    if (ch === "ー") {
      // Long vowel: repeat the previous vowel.
      const vowel = out.match(/[aeiou]$/)?.[0];
      if (vowel) out += vowel;
      continue;
    }
    let roman = COMBO[ch + (s[i + 1] ?? "")];
    if (roman) i++;
    else roman = BASE[ch] ?? ch;
    if (doubleNext) {
      out += roman.startsWith("ch") ? "t" : /^[a-z]/.test(roman) && !/^[aeiou]/.test(roman) ? roman[0] : "";
      doubleNext = false;
    }
    out += roman;
  }
  return out;
}

export const hasKana = (text: string) => /[぀-ヿ]/.test(text);
export const hasJapanese = (text: string) => /[぀-ヿ一-鿿]/.test(text);

const KANA = /[぀-ヿ]/;

/** Romanize one tokenized line: Japanese words separated by spaces, anything
 *  else (Latin words, punctuation) kept exactly as written. */
function romanizeTokens(tokens: Token[]): string {
  let out = "";
  let pendingKana = ""; // a word ending in っ/ッ waits to be merged with the next
  let lastWasJapanese = false;

  for (const tok of tokens) {
    let kana = tok.reading && tok.reading !== "*" ? tok.reading : tok.surface_form;
    const japanese = KANA.test(kana);

    if (!japanese) {
      if (pendingKana) out += (out && !out.endsWith(" ") ? " " : "") + kanaToRomaji(pendingKana);
      pendingKana = "";
      // Separate from a preceding Japanese word unless the original already does.
      if (lastWasJapanese && !/^[\s,.!?、。！？」』)']/.test(tok.surface_form)) out += " ";
      out += tok.surface_form;
      lastWasJapanese = false;
      continue;
    }

    // Particles are pronounced differently from how they're written.
    if (tok.pos === "助詞" && !pendingKana) {
      const particle = { は: "ワ", へ: "エ", を: "オ" }[tok.surface_form];
      if (particle) kana = particle;
    }
    kana = pendingKana + kana;
    pendingKana = "";
    // 回っ|て → keep っ with the next word so it can double its consonant.
    if (/[っッ]$/.test(kana)) {
      pendingKana = kana;
      continue;
    }
    if (out && !out.endsWith(" ")) out += " ";
    out += kanaToRomaji(kana);
    lastWasJapanese = true;
  }
  if (pendingKana) out += (out && !out.endsWith(" ") ? " " : "") + kanaToRomaji(pendingKana);
  return out.replace(/\s+/g, " ").trim();
}

/** Romanize Japanese lines (one tokenizer pass per line). */
export async function romanizeJapanese(lines: string[]): Promise<string[]> {
  const t = await getTokenizer();
  return lines.map((line) => romanizeTokens(t.tokenize(line)));
}

/** Exported for test/romanize.test.mjs (the tokenizer itself needs the browser loader). */
export const _romanizeTokens = romanizeTokens;
