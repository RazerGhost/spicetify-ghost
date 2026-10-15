# Developing Ghost

How to work on Ghost, and how it gets from this repo to people's Spotify. For
installing and using the theme, see the [README](README.md).

## Setup

```powershell
npm install
.\install.ps1 -Local   # links Spicetify\Themes\Ghost -> .\dist and applies (./install.sh --local elsewhere)
npm run dev            # esbuild watch — rebuilds dist\ on save
spicetify watch -s     # optional, separate terminal: reloads Spotify on change
```

| Script | What it does |
| --- | --- |
| `npm run build` | One-off production build into `dist/` |
| `npm run dev` | Rebuild on save, with dev helpers and inline source maps |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (lyrics parsing, romanization) |
| `npm run check` | Selector check against the installed Spotify (see below) |

## Debugging

Enable DevTools once with `spicetify enable-devtools`, then `Ctrl+Shift+I` in Spotify.
Dev builds add console helpers:

| Command | What it shows |
| --- | --- |
| `ghost.pick()` | Click anywhere: every element stacked under that point (even covered or click-through ones) and what each paints |
| `ghost.tree(".selector", depth)` | Compact outline of a subtree; `copy(ghost.tree(…))` to share it |
| `ghost.inspect($0)` | The selected element's ancestors: readable classes, hashed classes, `data-testid`/`aria-*` |
| `ghost.bg()` | What the background code sees (image candidates, errors) |
| `ghost.check()` | Each Ghost selector and how many elements it matches on the current page |
| `ghost.rules("home")` | Every selector in Spotify's loaded stylesheets containing the term |
| `ghost.classes("nav")` | Readable class names currently in the DOM |

## Selector rules

Spotify changes its markup with updates, and other themes' selectors go stale. So:

1. Take hooks only from the installed Spotify (or Spicetify itself), never from other themes.
2. Prefer, in order: Spotify's CSS variables → readable classes (`Root__*`, `main-*`) →
   `data-testid`/`role`/structure → Spicetify APIs/components. Hashed classes only as
   a last resort, with a comment.
3. After a Spotify update run `npm run check`: it lists every class, id, attribute and
   Spotify variable Ghost uses (CSS and TS) and whether the installed Spotify still has it.

## Layout

| Path | What it does |
| --- | --- |
| `src/styles/*.css` | The look, one file per area; joined in file-name order into `user.css`. |
| `color.ini` | Colour schemes → `--spice-<name>` / `--spice-rgb-<name>`. |
| `src/index.ts`, `src/app.tsx` | Wait for Spicetify's APIs, then start every feature. |
| `src/background.ts` | Baked album-art background, accent colour, crossfade timing. |
| `src/settings/` | Settings store (localStorage → CSS vars/classes) and the React panel. |
| `src/lyrics/` | Providers + parsers, synced renderer, lyrics page, fullscreen, now-playing card, PiP. |
| `src/platform.ts` | Typed access to the Spotify-internal APIs Ghost uses. |
| `src/intercept.ts` | Takes over clicks on Spotify's own buttons (lyrics, fullscreen, canvas). |
| `src/watch.ts` | One shared, frame-throttled DOM observer. |
| `src/dev.ts` | The `ghost.*` console helpers (dev builds only). |
| `build.mjs` | esbuild (maps `react` to `Spicetify.React`) + CSS assembly; copies `color.ini`, `LICENSE` and `docs/dist-README.md` into `dist/`. |
| `scripts/check-selectors.mjs` | `npm run check`. |
| `remote/` | Loader stubs used by the script install. |
| `manifest.json` | What the Spicetify Marketplace reads. |
| `docs/screenshots/` | README screenshots; `01-home.jpg` is also the Marketplace preview. |

## Release

Push to `main`. The GitHub Action type-checks, tests, builds and publishes `dist/` to
the `dist` branch (force-pushed, one run at a time), then purges jsDelivr's cache for
`@dist`. Every way of installing Ghost loads from `dist`, so nothing on `main` reaches
users until that build has run.

### How each install picks up a release

**Marketplace.** The Marketplace finds the repo by its `spicetify-themes` topic and
reads `manifest.json` from the default branch (`main`). Its `"branch": "dist"` makes
the relative paths (`user.css`, `color.ini`) resolve against `dist`; `preview`,
`readme` and `include` are absolute URLs. On each Spotify start the Marketplace loads
`user.css` and `theme.js` from jsDelivr `@dist`, so updates usually arrive on the next
restart — or within jsDelivr's ~12 h cache when a purge was throttled.

**Install script.** `install.ps1` / `install.sh` put the stubs from `remote/` (plus
`color.ini`) in `Themes/Ghost`. On each Spotify start the loader asks the GitHub API
for the latest `dist` commit and loads `theme.js` / `user.css` from jsDelivr pinned to
that commit: unchanged → straight from cache, new → downloaded. Offline or
rate-limited starts use the last known commit.

**By hand.** A copy of `dist`; never updates.

`color.ini` is read by Spicetify at `apply` time (and by the Marketplace at install),
so colour-scheme changes only reach people who re-run the installer, `spicetify apply`
or reinstall; CSS and JS changes arrive on their own.
