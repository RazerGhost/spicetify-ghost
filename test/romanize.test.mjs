import assert from "node:assert/strict";
import { test } from "node:test";
import { _romanizeTokens, hasJapanese, hasKana, kanaToRomaji } from "../src/lyrics/romanize/japanese";
import { hasHangul, romanizeKorean } from "../src/lyrics/romanize/korean";

// --- Korean ----------------------------------------------------------------------

test("Korean: plain syllables", () => {
  assert.equal(romanizeKorean("안녕하세요"), "annyeonghaseyo");
  assert.equal(romanizeKorean("사랑"), "sarang");
});

test("Korean: liaison", () => {
  assert.equal(romanizeKorean("한국어"), "hangugeo");
});

test("Korean: nasalisation", () => {
  assert.equal(romanizeKorean("감사합니다"), "gamsahamnida");
});

test("Korean: ㄹ rules", () => {
  assert.equal(romanizeKorean("신라"), "silla");
});

test("Korean: ㅎ aspiration", () => {
  assert.equal(romanizeKorean("좋다"), "jota");
  assert.equal(romanizeKorean("맞히다"), "machida");
});

test("Korean: other text is kept", () => {
  assert.equal(romanizeKorean("Hello 사랑!"), "Hello sarang!");
  assert.ok(hasHangul("a 가"));
  assert.ok(!hasHangul("abc"));
});

// --- Japanese --------------------------------------------------------------------

test("kanaToRomaji: basics, hiragana and katakana", () => {
  assert.equal(kanaToRomaji("ありがとう"), "arigatou");
  assert.equal(kanaToRomaji("カタカナ"), "katakana");
});

test("kanaToRomaji: combinations", () => {
  assert.equal(kanaToRomaji("きょう"), "kyou");
  assert.equal(kanaToRomaji("しゃしん"), "shashin");
});

test("kanaToRomaji: small tsu doubles the consonant", () => {
  assert.equal(kanaToRomaji("がっこう"), "gakkou");
  assert.equal(kanaToRomaji("まっちゃ"), "matcha");
});

test("kanaToRomaji: long vowel mark", () => {
  assert.equal(kanaToRomaji("ラーメン"), "raamen");
  assert.equal(kanaToRomaji("コーヒー"), "koohii");
});

const tok = (surface_form, reading, pos = "名詞") => ({ surface_form, reading, pos });

test("romanizeTokens: words spaced, particles by pronunciation", () => {
  const tokens = [tok("私", "ワタシ"), tok("は", "ハ", "助詞"), tok("学生", "ガクセイ")];
  assert.equal(_romanizeTokens(tokens), "watashi wa gakusei");
});

test("romanizeTokens: っ at a word end merges with the next word", () => {
  assert.equal(_romanizeTokens([tok("回っ", "マワッ", "動詞"), tok("て", "テ", "助詞")]), "mawatte");
});

test("romanizeTokens: Latin text and punctuation kept", () => {
  assert.equal(_romanizeTokens([tok("愛", "アイ"), tok("love", undefined)]), "ai love");
  assert.equal(_romanizeTokens([tok("愛", "アイ"), tok("!", undefined, "記号")]), "ai!");
});

test("script detection", () => {
  assert.ok(hasKana("ひらがな"));
  assert.ok(!hasKana("漢字"));
  assert.ok(hasJapanese("漢字"));
  assert.ok(!hasJapanese("abc"));
});
