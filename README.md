# Ghost

A lightweight, glassy [Spicetify](https://spicetify.app) theme. Inspired by
[Lucid](https://github.com/sanoojes/spicetify-lucid) and
[Hazy](https://github.com/Astromations/Hazy), but written to stay small: the look is
plain CSS, and the only JS is the album-art background plus a React settings panel
that uses Spotify's own React (nothing bundled).

## Install

```powershell
iwr -useb https://raw.githubusercontent.com/RazerGhost/spicetify-ghost/main/install.ps1 | iex
```

This places two tiny loader files (plus `color.ini`) in `Spicetify\Themes\Ghost`,
sets Ghost as the current theme and runs `spicetify apply`. The loaders fetch the theme
from the `dist` branch via jsDelivr, so every push to `main` reaches you on the next
Spotify start.

Pick a colour scheme (`dark`, `oled`) with `.\install.ps1 -Scheme oled`, or:

```powershell
spicetify config color_scheme oled; spicetify apply
```

Go back to your previous theme: `spicetify config current_theme marketplace; spicetify apply`.

## Develop

```powershell
npm install
.\install.ps1 -Local   # links Spicetify\Themes\Ghost -> .\dist and applies
npm run dev            # esbuild watch — rebuilds dist\ on save
spicetify watch -s     # optional, separate terminal: reloads Spotify on change
```

Enable DevTools once with `spicetify enable-devtools`, then `Ctrl+Shift+I` in Spotify.
Dev builds add console helpers:

| Command | What it shows |
| --- | --- |
| `ghost.check()` | Each `user.css` selector and how many elements it matches on the current page |
| `ghost.inspect($0)` | The selected element's ancestors: readable classes, hashed classes, `data-testid`/`aria-*` |
| `ghost.rules("home")` | Every selector in Spotify's loaded stylesheets containing the term |
| `ghost.classes("nav")` | Readable class names currently in the DOM |

### Selector rules

Spotify changes its markup with updates, and other themes' selectors go stale. So:

1. Take hooks only from the installed Spotify (or Spicetify itself), never from other themes.
2. Prefer, in order: Spotify's CSS variables → `Root__*` classes → `data-testid`/`aria-*` →
   Spicetify APIs/components. Hashed classes only as a last resort, with a comment.
3. After a Spotify update run `npm run check`: it lists every class, id, attribute and
   Spotify variable Ghost uses and whether the installed Spotify still has it.

| File | What it does |
| --- | --- |
| `src/user.css` | The whole look. Tunables are `--ghost-*` variables at the top. |
| `color.ini` | Colour schemes → `--spice-<name>` / `--spice-rgb-<name>`. |
| `src/index.ts` | Waits for Spicetify's APIs, then loads the app. |
| `src/background.ts` | Album-art crossfade + accent colour from the art. |
| `src/settings/` | Settings store (localStorage → CSS vars) and React panel. |
| `build.mjs` | esbuild; maps `react` imports to `Spicetify.React`. |
| `remote/` | Loader stubs used by the remote install. |

`color.ini` is read by Spicetify at `apply` time, so colour-scheme changes need a
re-run of the installer (or `spicetify apply`); everything else updates remotely.

## Release

Push to `main`. The GitHub Action type-checks, builds, publishes `dist/` to the
`dist` branch and purges the jsDelivr cache.
