import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLRC, parseTime, staticLyrics } from "../src/lyrics/parse";

test("parseTime: clock values", () => {
  assert.equal(parseTime("1:02.5"), 62.5);
  assert.equal(parseTime("01:00:01"), 3601);
  assert.equal(parseTime("7.25"), 7.25);
});

test("parseTime: offset values", () => {
  assert.equal(parseTime("12.3s"), 12.3);
  assert.equal(parseTime(".5s"), 0.5);
  assert.equal(parseTime("500ms"), 0.5);
  assert.equal(parseTime("1.5m"), 90);
  assert.equal(parseTime("1h"), 3600);
});

test("parseTime: missing or unreadable → 0", () => {
  assert.equal(parseTime(undefined), 0);
  assert.equal(parseTime(""), 0);
  assert.equal(parseTime("abc"), 0);
  assert.equal(parseTime("3f"), 0);
});

test("parseLRC: line-synced, sorted, metadata ignored", () => {
  const lyrics = parseLRC("[ar:Someone]\n[00:10.00]Second\n[00:05.50]First\n", 60);
  assert.equal(lyrics.kind, "line");
  assert.equal(lyrics.provider, "lrclib");
  assert.deepEqual(
    lyrics.lines.map((l) => [l.text, l.start, l.end]),
    [
      ["First", 5.5, 10],
      ["Second", 10, 60], // last line lasts until the song ends
    ],
  );
});

test("parseLRC: last line lasts at least 5 s", () => {
  const lyrics = parseLRC("[00:58.00]End", 60);
  assert.equal(lyrics.lines[0].end, 63);
});

test("parseLRC: repeated tags and mm:ss:xx", () => {
  const lyrics = parseLRC("[00:01.00][00:03:00]Chorus\n[00:02.00]Verse", 10);
  assert.deepEqual(
    lyrics.lines.map((l) => [l.text, l.start]),
    [
      ["Chorus", 1],
      ["Verse", 2],
      ["Chorus", 3],
    ],
  );
});

test("parseLRC: enhanced word timing", () => {
  const lyrics = parseLRC("[00:01.00]<00:01.00>Hello <00:01.50>world\n[00:03.00]Next", 10);
  assert.equal(lyrics.kind, "word");
  const [first] = lyrics.lines;
  assert.equal(first.text, "Hello world");
  assert.deepEqual(first.words, [
    { text: "Hello ", start: 1, end: 1.5 },
    { text: "world", start: 1.5, end: 3 },
  ]);
});

test("parseLRC: empty lines dropped, nothing → null", () => {
  assert.equal(parseLRC("[00:01.00]A\n[00:02.00]\n[00:03.00]B", 10).lines.length, 2);
  assert.equal(parseLRC("no timestamps here", 10), null);
});

test("staticLyrics", () => {
  const lyrics = staticLyrics(" one \ntwo", "spotify");
  assert.equal(lyrics.kind, "static");
  assert.deepEqual(
    lyrics.lines.map((l) => l.text),
    ["one", "two"],
  );
});
