import assert from "node:assert/strict";
import { test } from "node:test";
import { DOMParser, parseHTML } from "linkedom";

// parseTTML runs in the browser; give it DOMParser, Node and Element from linkedom.
const dom = parseHTML("<p></p>");
globalThis.DOMParser = DOMParser;
globalThis.Node = dom.Node;
globalThis.Element = dom.Element;
const { parseTTML } = await import("../src/lyrics/parse");

const ttml = (body) =>
  `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body><div>${body}</div></body></tt>`;

test("parseTTML: word-timed line keeps spacing", () => {
  const lyrics = parseTTML(ttml('<p begin="1.0" end="3.0" ttm:agent="v1"><span begin="1.0" end="1.5">Hello</span> <span begin="1.5" end="3.0">world</span></p>'));
  assert.equal(lyrics.kind, "word");
  assert.equal(lyrics.provider, "amll");
  const [line] = lyrics.lines;
  assert.equal(line.text, "Hello world");
  assert.deepEqual([line.start, line.end], [1, 3]);
  assert.deepEqual(
    line.words.map((w) => [w.text, w.start, w.end]),
    [
      ["Hello ", 1, 1.5],
      ["world", 1.5, 3],
    ],
  );
});

test("parseTTML: line-timed only (no word spans)", () => {
  const lyrics = parseTTML(ttml('<p begin="00:01.000" end="00:02.500">Just a line</p>'));
  assert.equal(lyrics.kind, "line");
  assert.equal(lyrics.lines[0].text, "Just a line");
  assert.equal(lyrics.lines[0].end, 2.5);
});

test("parseTTML: background vocals are split off the main line", () => {
  const lyrics = parseTTML(
    ttml(
      '<p begin="1" end="4"><span begin="1" end="2">Main</span><span ttm:role="x-bg"><span begin="2" end="3">(echo)</span></span></p>',
    ),
  );
  const [line] = lyrics.lines;
  assert.equal(line.text, "Main");
  assert.equal(line.background.text, "(echo)");
});

test("parseTTML: second agent sings on the opposite side", () => {
  const lyrics = parseTTML(
    ttml('<p begin="1" end="2" ttm:agent="v1">One</p><p begin="2" end="3" ttm:agent="v2">Two</p><p begin="3" end="4" ttm:agent="v1">Three</p>'),
  );
  assert.deepEqual(
    lyrics.lines.map((l) => !!l.opposite),
    [false, true, false],
  );
});

test("parseTTML: empty lines dropped; broken XML → null", () => {
  assert.equal(parseTTML(ttml('<p begin="1" end="2">A</p><p begin="2" end="3"></p>')).lines.length, 1);
  assert.equal(parseTTML("<tt><body>"), null);
  assert.equal(parseTTML(ttml("")), null);
});
