// Chinese → pinyin with tone marks, via pinyin-pro (MIT, ~320 KB) loaded from
// jsDelivr only when Chinese romanization is turned on.

import { loadGlobal } from "./load";

const PINYIN_PRO = "https://cdn.jsdelivr.net/npm/pinyin-pro@3.29.4/dist/index.js";

type PinyinPro = { pinyin(text: string, options: { toneType: "symbol"; nonZh: "consecutive" }): string };

export const hasHan = (text: string) => /[一-鿿]/.test(text);

export async function romanizeChinese(lines: string[]): Promise<string[]> {
  const { pinyin } = await loadGlobal<PinyinPro>(PINYIN_PRO, "pinyinPro");
  // nonZh "consecutive" keeps runs of Latin text/punctuation together.
  return lines.map((line) => pinyin(line, { toneType: "symbol", nonZh: "consecutive" }).replace(/\s+/g, " ").trim());
}
