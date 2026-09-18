// Bundles src/ into dist/ (theme.js, user.css, color.ini).
// React is NOT bundled: imports of react / react-dom / react/jsx-runtime are
// redirected to the copies Spotify already ships (Spicetify.React & co).
//
//   node build.mjs         one-off production build
//   node build.mjs --dev   rebuild on change (pair with `spicetify watch -s` yourself)

import * as esbuild from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import { watch } from "node:fs";

const dev = process.argv.includes("--dev");

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

const staticFiles = [
  ["src/user.css", "dist/user.css"],
  ["color.ini", "dist/color.ini"],
];

async function copyStatic() {
  await mkdir("dist", { recursive: true });
  await Promise.all(staticFiles.map(([from, to]) => copyFile(from, to)));
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
  plugins: [spicetifyGlobals],
};

await copyStatic();

if (!dev) {
  await esbuild.build(options);
} else {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  for (const [from] of staticFiles) {
    watch(from, () => copyStatic().catch(console.error));
  }
}
