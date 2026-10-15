# Ghost

A lightweight, glassy [Spicetify](https://spicetify.app) theme with built-in synced
lyrics. Inspired by [Lucid](https://github.com/sanoojes/spicetify-lucid) and
[Hazy](https://github.com/Astromations/Hazy), but written to stay small: the look is
plain CSS, and the JS (~37 KB) uses Spotify's own React instead of bundling one.

## Features

- **Background** — blurred album art (or a custom image / solid colour), baked once
  per song into a small canvas so it costs nothing per frame; optional animation and
  film grain.
- **Glass UI** — translucent panels, top bar and player bar; accent colour from the
  album art, optionally mixed into every surface ("tint").
- **Lyrics** — replaces Spotify's lyrics page. Word-synced lyrics from the
  [AMLL TTML DB](https://github.com/amll-dev/amll-ttml-db) (duets, background vocals),
  otherwise Spotify's own lyrics, otherwise [LRCLIB](https://lrclib.net). Also a
  fullscreen view (Spotify's fullscreen button) — the whole screen when Spotify is
  maximised, just Spotify's window when it isn't (e.g. split-screen) — and a card in
  the now-playing view.
- **Player** — volume percentage (click to type a value, scroll over the slider to
  fine-tune), floating player bar.
- **Spicetify Marketplace** styled to match.

Everything is configurable from the ghost button in the top bar.

## Install

### Spicetify Marketplace

Open the Marketplace in Spotify → **Themes** → search for **Ghost** → **Install**.
Pick a colour scheme (`dark`, `oled`) in the Marketplace settings. The Marketplace
loads Ghost from the `dist` branch, so updates arrive on a Spotify restart.

### Install script

Windows (PowerShell):

```powershell
iwr -useb https://raw.githubusercontent.com/RazerGhost/spicetify-ghost/main/install.ps1 | iex
```

macOS / Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/RazerGhost/spicetify-ghost/main/install.sh | sh
```

This places a tiny loader (plus `color.ini`) in Spicetify's `Themes/Ghost`, sets Ghost
as the current theme and runs `spicetify apply`. On each Spotify start the loader asks
the GitHub API for the latest `dist` commit and loads `theme.js` / `user.css` from
jsDelivr pinned to that commit: unchanged → straight from cache, new → downloaded. So
every push to `main` reaches you on the next Spotify start (once the build has run),
and offline starts use the last cached version.

Pick a colour scheme (`dark`, `oled`) with `.\install.ps1 -Scheme oled` /
`sh -s -- --scheme oled`, or:

```sh
spicetify config color_scheme oled
spicetify apply
```

Go back to your previous theme: `spicetify config current_theme marketplace; spicetify apply`.

### By hand

The [`dist` branch](https://github.com/RazerGhost/spicetify-ghost/tree/dist) is the
complete built theme. Download it as a
[ZIP](https://github.com/RazerGhost/spicetify-ghost/archive/refs/heads/dist.zip),
extract it into Spicetify's `Themes` folder (`spicetify path userdata`), rename the
folder to `Ghost`, then:

```sh
spicetify config inject_css 1 replace_colors 1 overwrite_assets 1 inject_theme_js 1
spicetify config current_theme Ghost color_scheme dark
spicetify apply
```

A hand install doesn't update itself.

## Develop

```powershell
npm install
.\install.ps1 -Local   # links Spicetify\Themes\Ghost -> .\dist and applies (./install.sh --local elsewhere)
npm run dev            # esbuild watch — rebuilds dist\ on save
spicetify watch -s     # optional, separate terminal: reloads Spotify on change
```

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

### Selector rules

Spotify changes its markup with updates, and other themes' selectors go stale. So:

1. Take hooks only from the installed Spotify (or Spicetify itself), never from other themes.
2. Prefer, in order: Spotify's CSS variables → readable classes (`Root__*`, `main-*`) →
   `data-testid`/`role`/structure → Spicetify APIs/components. Hashed classes only as
   a last resort, with a comment.
3. After a Spotify update run `npm run check`: it lists every class, id, attribute and
   Spotify variable Ghost uses (CSS and TS) and whether the installed Spotify still has it.

### Layout

| Path | What it does |
| --- | --- |
| `src/styles/*.css` | The look, one file per area; joined in file-name order into `user.css`. |
| `color.ini` | Colour schemes → `--spice-<name>` / `--spice-rgb-<name>`. |
| `src/index.ts`, `src/app.tsx` | Wait for Spicetify's APIs, then start every feature. |
| `src/background.ts` | Baked album-art background, accent colour, crossfade timing. |
| `src/settings/` | Settings store (localStorage → CSS vars/classes) and the React panel. |
| `src/lyrics/` | Providers + parsers, synced renderer, lyrics page, fullscreen, now-playing card. |
| `src/platform.ts` | Typed access to the Spotify-internal APIs Ghost uses. |
| `src/intercept.ts` | Takes over clicks on Spotify's own buttons (lyrics, fullscreen, canvas). |
| `src/watch.ts` | One shared, frame-throttled DOM observer. |
| `src/dev.ts` | The `ghost.*` console helpers (dev builds only). |
| `build.mjs` | esbuild (maps `react` to `Spicetify.React`) + CSS assembly. |
| `scripts/check-selectors.mjs` | `npm run check`. |
| `remote/` | Loader stubs used by the remote install. |

`color.ini` is read by Spicetify at `apply` time, so colour-scheme changes need a
re-run of the installer (or `spicetify apply`); everything else updates remotely.

## Release

Push to `main`. The GitHub Action type-checks, builds and publishes `dist/` to the
`dist` branch; remote installs pick up the new `dist` commit on their next start.

## Publishing

`manifest.json` is what the Marketplace reads (from `main`). It points at the `dist`
branch for `user.css`, `color.ini` and `theme.js`, which CI rebuilds on every push.
The Marketplace finds the repo by its `spicetify-themes` GitHub topic and shows
`docs/preview.png` on the card.

## License

[MIT](LICENSE)
