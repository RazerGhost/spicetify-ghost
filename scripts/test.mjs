// Runs the unit tests in test/*.test.mjs with node:test.
// The tests import TypeScript from src/ with extensionless paths, which Node
// can't load directly, so each test file is bundled with esbuild first.
//
//   npm test

import * as esbuild from "esbuild";
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const OUT = join("node_modules", ".cache", "ghost-tests");
const tests = readdirSync("test").filter((f) => f.endsWith(".test.mjs"));

rmSync(OUT, { recursive: true, force: true });
await esbuild.build({
  entryPoints: tests.map((f) => join("test", f)),
  outdir: OUT,
  bundle: true,
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  logLevel: "warning",
});

// node --test treats its arguments as globs, which skip node_modules — so run it
// from inside the output folder with bare file names.
const { status } = spawnSync(process.execPath, ["--test", ...tests], { cwd: OUT, stdio: "inherit" });
process.exit(status ?? 1);
