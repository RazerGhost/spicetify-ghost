// Hangul → Revised Romanization, written for Ghost (no dependency: the common
// library, aromanize, patches String.prototype, which a theme shouldn't do).
// Covers the sound changes that matter for reading along with a song:
// liaison (final consonant carried onto a following ㅇ), nasalisation, the ㄹ
// rules and ㅎ aspiration. Not a full phonological model — good enough for lyrics.

const SYLLABLE_START = 0xac00;
const SYLLABLE_END = 0xd7a3;

// Initial consonants (choseong), in Unicode order. Index 11 (ㅇ) is silent.
const INITIAL = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const SILENT_INITIAL = 11;
const I = { g: 0, n: 2, d: 3, r: 5, m: 6, b: 7, s: 9, j: 12, h: 18 } as const;

// Vowels (jungseong), in Unicode order.
const VOWEL = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];

// Final consonants (jongseong), in Unicode order: [sound at end of syllable,
// [what stays, what moves onto a following silent ㅇ]].
const FINAL: [string, [string, string]][] = [
  ["", ["", ""]], // none
  ["k", ["", "g"]], // ㄱ
  ["k", ["", "kk"]], // ㄲ
  ["k", ["k", "s"]], // ㄳ
  ["n", ["", "n"]], // ㄴ
  ["n", ["n", "j"]], // ㄵ
  ["n", ["", "n"]], // ㄶ (ㅎ drops)
  ["t", ["", "d"]], // ㄷ
  ["l", ["", "r"]], // ㄹ
  ["k", ["l", "g"]], // ㄺ
  ["m", ["l", "m"]], // ㄻ
  ["l", ["l", "b"]], // ㄼ
  ["l", ["l", "s"]], // ㄽ
  ["l", ["l", "t"]], // ㄾ
  ["p", ["l", "p"]], // ㄿ
  ["l", ["", "r"]], // ㅀ (ㅎ drops)
  ["m", ["", "m"]], // ㅁ
  ["p", ["", "b"]], // ㅂ
  ["p", ["p", "s"]], // ㅄ
  ["t", ["", "s"]], // ㅅ
  ["t", ["", "ss"]], // ㅆ
  ["ng", ["ng", ""]], // ㅇ
  ["t", ["", "j"]], // ㅈ
  ["t", ["", "ch"]], // ㅊ
  ["k", ["", "k"]], // ㅋ
  ["t", ["", "t"]], // ㅌ
  ["p", ["", "p"]], // ㅍ
  ["t", ["", ""]], // ㅎ (drops before a vowel)
];
const F = { h: 27 } as const;

type Syllable = { initial: number; vowel: number; final: number };

const decompose = (code: number): Syllable => {
  const offset = code - SYLLABLE_START;
  return { initial: Math.floor(offset / 588), vowel: Math.floor((offset % 588) / 28), final: offset % 28 };
};

/** Romanize one run of consecutive Hangul syllables. */
function romanizeRun(run: string): string {
  const syllables = Array.from(run, (ch) => decompose(ch.codePointAt(0)!));
  let out = "";
  let carriedOnset: string | null = null; // onset moved in by liaison

  for (let i = 0; i < syllables.length; i++) {
    const { initial, vowel, final } = syllables[i];
    const next = syllables[i + 1];

    out += carriedOnset ?? INITIAL[initial];
    carriedOnset = null;
    out += VOWEL[vowel];
    if (!final) continue;

    if (!next) {
      out += FINAL[final][0];
      continue;
    }

    // Liaison: final consonant moves onto a following silent ㅇ.
    if (next.initial === SILENT_INITIAL && final !== 21) {
      const [stay, move] = FINAL[final][1];
      out += stay;
      carriedOnset = move;
      continue;
    }

    let coda = FINAL[final][0];
    let onset = INITIAL[next.initial];

    // ㅎ aspiration: ㅎ + ㄱ/ㄷ/ㅈ → k/t/ch; ㄱ/ㄷ/ㅂ/ㅈ + ㅎ → k/t/p/ch.
    if (final === F.h && [I.g, I.d, I.j].includes(next.initial as never)) {
      coda = "";
      onset = { [I.g]: "k", [I.d]: "t", [I.j]: "ch" }[next.initial]!;
    } else if (next.initial === I.h && ["k", "t", "p"].includes(coda)) {
      onset = coda === "t" && final === 22 ? "ch" : coda;
      coda = "";
    }
    // Nasalisation: k/t/p before ㄴ/ㅁ → ng/n/m.
    else if ((next.initial === I.n || next.initial === I.m) && ["k", "t", "p"].includes(coda)) {
      coda = { k: "ng", t: "n", p: "m" }[coda as "k" | "t" | "p"];
    }
    // ㄹ: ㄴ+ㄹ / ㄹ+ㄴ / ㄹ+ㄹ → ll; other finals before ㄹ make it n.
    else if (next.initial === I.r) {
      if (coda === "n" || coda === "l") {
        coda = "l";
        onset = "l";
      } else {
        onset = "n";
        if (coda === "k") coda = "ng";
        else if (coda === "p") coda = "m";
      }
    } else if (next.initial === I.n && coda === "l") {
      onset = "l";
    }

    out += coda;
    carriedOnset = onset;
  }
  return out;
}

const HANGUL_RUN = /[가-힣]+/g;

export const hasHangul = (text: string) => /[가-힣]/.test(text);

/** Romanize the Hangul in `text`, leaving everything else as it is. */
export function romanizeKorean(text: string): string {
  return text.replace(HANGUL_RUN, (run) => {
    // Guard against anything outside the syllable block slipping through.
    const valid = Array.from(run).every((c) => {
      const code = c.codePointAt(0)!;
      return code >= SYLLABLE_START && code <= SYLLABLE_END;
    });
    return valid ? romanizeRun(run) : run;
  });
}
