// Bundles src/ into dist/ (theme.js, user.css, color.ini).
// React is NOT bundled: imports of react / react-dom / react/jsx-runtime are
// redirected to the copies Spotify already ships (Spicetify.React & co).
// user.css is assembled from src/styles/*.css in file-name order (00-…, 10-…).
//
//   node build.mjs         one-off production build
//   node build.mjs --dev   rebuild on change (pair with `spicetify watch -s` yourself)

import * as esbuild from "esbuild";
import { copyFile, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { watch } from "node:fs";

const dev = process.argv.includes("--dev");
const STYLES = "src/styles";

const globals = {
  react: "Spicetify.React",
  "react-dom": "Spicetify.ReactDOM",
  "react/jsx-runtime": "Spicetify.ReactJSX",
};

/** @type {esbuild.Plugin} */
const spicetifyGlobals = {
  name: "spicetify-globals",
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|react\/jsx-runtime)$/ }, (args) => ({
      path: args.path,
      namespace: "spicetify-global",
    }));
    // CommonJS shim: evaluated lazily, i.e. only after index.ts has waited for Spicetify.
    build.onLoad({ filter: /.*/, namespace: "spicetify-global" }, (args) => ({
      contents: `module.exports = ${globals[args.path]};`,
      loader: "js",
    }));
  },
};

/** Write via a temp file + rename, so Spicetify never picks up a half-written file. */
async function writeAtomic(path, contents) {
  await writeFile(`${path}.tmp`, contents);
  await rename(`${path}.tmp`, path);
}

/** @type {esbuild.Plugin} */
const atomicOutput = {
  name: "atomic-output",
  setup(build) {
    // With write: false, esbuild hands the files over instead of writing them.
    build.onEnd(async (result) => {
      for (const file of result.outputFiles ?? []) await writeAtomic(file.path, file.contents);
    });
  },
};

async function buildCss() {
  const files = (await readdir(STYLES)).filter((f) => f.endsWith(".css")).sort();
  const parts = await Promise.all(files.map((f) => readFile(`${STYLES}/${f}`, "utf8")));
  await writeAtomic("dist/user.css", parts.map((css, i) => `/* ${files[i]} */\n${css.trim()}\n`).join("\n"));
}

async function buildStatic() {
  await mkdir("dist", { recursive: true });
  await Promise.all([buildCss(), copyFile("color.ini", "dist/color.ini")]);
}

const options = {
  entryPoints: ["src/index.ts"],
  outfile: "dist/theme.js",
  bundle: true,
  format: "iife",
  target: "chrome120",
  jsx: "automatic",
  minify: !dev,
  sourcemap: dev ? "inline" : false,
  legalComments: "none",
  define: { __DEV__: String(dev) },
  logLevel: "info",
  write: false, // atomicOutput writes theme.js
  plugins: [spicetifyGlobals, atomicOutput],
};

await buildStatic();

if (!dev) {
  await esbuild.build(options);
} else {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  // Editors often fire several events per save; coalesce them.
  let timer;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => buildStatic().catch(console.error), 50);
  };
  watch(STYLES, rebuild);
  watch("color.ini", rebuild);
}
