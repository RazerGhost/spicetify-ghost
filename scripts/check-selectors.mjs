// Checks that every Spotify hook Ghost relies on still exists in the installed Spotify.
// Run after a Spotify update:  npm run check
//
// Collects from src/:
//   - class names, ids and [data-testid]/[data-encore-id] values in styles/*.css selectors
//   - Spotify CSS variables the styles override (e.g. --panel-gap, --background-base)
//   - class names / data-testids in className="…" and selector strings in .ts/.tsx
// …and searches the installed xpui files (Spotify + Spicetify's helper scripts) for each.
// Ghost's own names (ghost*, --ghost-*, --spice-*) are skipped.

import { execSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = "src";

// --- locate Spotify's xpui folder via the Spicetify config ---------------------
function xpuiPath() {
  const configFile = execSync("spicetify -c", { encoding: "utf8" }).trim();
  const config = readFileSync(configFile, "utf8");
  const spotify = /^\s*spotify_path\s*=\s*(.+)$/m.exec(config)?.[1].trim();
  const xpui = spotify && join(spotify, "Apps", "xpui");
  if (!xpui || !existsSync(xpui)) {
    console.error(`xpui folder not found (${xpui ?? "no spotify_path"}). Run \`spicetify apply\` first.`);
    process.exit(2);
  }
  return xpui;
}

function walk(dir, ext, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, ext, out);
    else if (ext.test(entry.name)) out.push(p);
  }
  return out;
}

// --- collect hooks from our sources --------------------------------------------
const hooks = new Map(); // token -> where we use it

function add(token, kind, from) {
  if (/^ghost/i.test(token) || /^--(ghost|spice)-/.test(token)) return;
  const key = `${kind}:${token}`;
  if (!hooks.has(key)) hooks.set(key, { token, kind, from: new Set() });
  hooks.get(key).from.add(from);
}

for (const file of walk(join(SRC, "styles"), /\.css$/)) {
  const from = relative(SRC, file);
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  // Rule preludes = text before each "{" that isn't an at-rule or keyframe step.
  for (const [, raw] of css.matchAll(/([^{};]+)\{/g)) {
    const prelude = raw.trim();
    if (!prelude || prelude.startsWith("@") || /^(from|to|[\d.]+%)$/.test(prelude)) continue;
    for (const [, c] of prelude.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) add(c, "class", from);
    for (const [, id] of prelude.matchAll(/#([_a-zA-Z][\w-]*)/g)) add(id, "id", from);
    for (const [, , v] of prelude.matchAll(/\[(data-testid|data-encore-id)[~|^$*]?=["']?([^"'\]]+)/g))
      add(v, "attr", from);
  }

  // Custom properties we *set* that belong to Spotify — only inside declaration
  // blocks, so selectors like `.ghost-fs--idle :is(…)` aren't mistaken for one.
  for (const [, block] of css.matchAll(/\{([^{}]*)\}/g))
    for (const [, prop] of block.matchAll(/(?:^|;)\s*(--[\w-]+)\s*:/g)) add(prop, "var", from);
}

// className="…" in TSX, and classes in querySelector(All)/closest/matches/
// interceptClick("…") selectors and SELECTOR_CONSTANTS in TS/TSX.
for (const file of walk(SRC, /\.tsx?$/)) {
  const code = readFileSync(file, "utf8");
  const from = relative(SRC, file);
  for (const [, list] of code.matchAll(/className="([^"]+)"/g))
    for (const c of list.split(/\s+/)) add(c, "class", from);
  // `?.` allowed before the call; the string ends at the same quote it opened with,
  // so '[data-testid="x"]' is read whole.
  const selectors = [
    ...code.matchAll(/(?:querySelector(?:All)?|closest|matches|interceptClick)(?:<[^>]*>)?(?:\?\.)?\(\s*(["'`])(.*?)\1/g),
    // Selectors kept in constants, e.g. const BAR = ".main-nowPlayingBar-volumeBar".
    ...code.matchAll(/\bconst [A-Z][A-Z0-9_]*\s*=\s*(["'`])([.#[].*?)\1/g),
  ];
  for (const [, , selector] of selectors) {
    for (const [, c] of selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) add(c, "class", from);
    for (const [, , v] of selector.matchAll(/\[(data-testid|data-encore-id)[~|^$*]?=["']?([^"'\]]+)/g)) add(v, "attr", from);
  }
}

// --- search the installed Spotify ----------------------------------------------
const xpui = xpuiPath();
const ours = new Set(["user.css", "colors.css", join("extensions", "theme.js")]);
const files = walk(xpui, /\.(js|css)$/)
  .filter((f) => !ours.has(relative(xpui, f)))
  .map((f) => ({ name: relative(xpui, f), text: readFileSync(f, "utf8") }));

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
let missing = 0;
const rows = [];

for (const { token, kind, from } of hooks.values()) {
  const re = new RegExp(`(?<![\\w-])${escape(token)}(?![\\w-])`);
  const hits = files.filter((f) => re.test(f.text)).map((f) => f.name);
  if (!hits.length) missing++;
  rows.push({
    status: hits.length ? "ok" : "MISSING",
    kind,
    hook: token,
    foundIn: hits.length ? `${hits.slice(0, 2).join(", ")}${hits.length > 2 ? ` +${hits.length - 2}` : ""}` : "-",
    usedIn: [...from].join(", "),
  });
}

rows.sort((a, b) => (a.status === b.status ? a.hook.localeCompare(b.hook) : a.status === "MISSING" ? -1 : 1));
console.log(`Spotify xpui: ${xpui}\n`);
console.table(rows);
console.log(missing ? `\n${missing} hook(s) not found in this Spotify build.` : "\nAll hooks found.");
process.exit(missing ? 1 : 0);
