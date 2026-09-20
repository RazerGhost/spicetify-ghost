# Code review notes

Review of `src/`, `build.mjs`, `scripts/`, `remote/` and the release workflow (2026-09-19).
CSS was only skimmed, not indexed. `tsc --noEmit` passes.

Findings have IDs (B = bug, D = duplication/refactor, R = robustness, T = tooling)
so the function index below can point at them.

**Status:** all findings below have been fixed. Line numbers in the tables are from
before the fixes. Changes worth knowing:
- D2–D4: `Progress` and `PlayerControls` are now in `lyrics/controls.tsx`, and the
  PiP/fullscreen buttons in `lyrics/LyricsActions.tsx`. CSS classes were renamed
  `ghost-fs__progress/bar/fill/times` → `ghost-progress*`, and
  `ghost-fs__play`/`ghost-pip__play` → `ghost-controls__play`.
- D5: the route lives in `lyrics/route.ts`. D7: `mountIn()` is in `react.ts`.
- R2: AMLL and Spotify are now requested in parallel, with AMLL still preferred.
  Every request times out after 8 s.
- T1: `npm test` bundles `test/*.test.mjs` with esbuild and runs `node --test`, and CI
  runs it too. `parseTTML` is covered via the `linkedom` dev dependency.

## Findings

### Bugs

| ID  | Where | Issue | Fix |
| --- | ----- | ----- | --- |
| B1  | `lyrics/providers.ts:148` `currentTrack` | `Number(meta.duration) ?? 0` never falls back: `Number(undefined)` is `NaN`. LRCLIB gets `duration=NaN`; `parseLRC` gives the last line `end: NaN`. | `Number(meta.duration) \|\| 0` |
| B2  | `background.ts:275` `updateAccent` | No staleness check after the awaited colour lookup: skipping songs quickly can leave the previous song's accent. | Capture the track URI and bail out if it changed (like `updateImage`'s `src !== lastImage`). |
| B3  | `settings/Panel.tsx:130` `UrlInput` | `draft` is only initialised once; "Reset to defaults" with the panel open leaves the old URL showing. | `key={value}` on `<UrlInput>`, or sync the draft in an effect. |
| B4  | `lyrics/hooks.ts:20` `useLyrics` | After a track change the first render still returns the old `ready` state, and `LyricsBody` remounts `LyricsView` (new `key`) with the old song's lyrics for a render. | Store the URI in the state; treat a mismatch as `loading`. |
| B5  | `lyrics/index.tsx:28` `initLyricsPage.sync` | `sync` runs only on history/settings changes. The "re-mount if Spotify dropped our host" check never runs when Spotify re-renders the main view on its own, and if `.Root__main-view` doesn't exist yet when the route changes, the page never mounts until the next navigation. | Also run `sync` from `onDomChange` (it's cheap when nothing changed). |
| B6  | `lyrics/romanize/index.ts:31` `romanize.fill` | A failed library load (offline) is caught inside `romanize`, so the *resolved* partial result is cached in `romanizeCached` for that song and options. Toggling the setting off/on hits the same cache entry, so there's no retry for that song this session, even though `loadGlobal` allows retries. | Don't cache results where a `fill` failed (or reject and delete on failure). |
| B7  | `lyrics/pip.tsx:61` `togglePip` | Two clicks while `requestWindow` is pending open two windows; Chromium closes the first, whose `pagehide` then sets `pipWindow = null` while the second is open. The next click opens a new window instead of closing it. | Track an "opening" promise, and only clear `pipWindow` if it's still `win`. |
| B8  | `lyrics/providers.ts:84` `fromLrclib` | The search fallback returns `results[0]` even when no result's duration is close. That can show lyrics for a different song or version. | Only accept results within the duration tolerance (plain lyrics included). |

### Duplication / refactors

| ID  | Where | Issue |
| --- | ----- | ----- |
| D1  | `FullscreenView.tsx:71-74`, `PipView.tsx:25-26` | Album art is re-derived via `useState(albumArt)` plus an effect; `TrackInfo.image` already holds `albumArt()`. Use `track?.image`. |
| D2  | `FullscreenView.tsx:106`, `PipView.tsx:54` | Prev/play/next buttons are duplicated. Extract `<PlayerControls size>`. |
| D3  | `LyricsPage.tsx:16`, `npvCard.tsx:28` | PiP and fullscreen buttons are duplicated. Extract `<LyricsActions className>`. |
| D4  | `FullscreenView.tsx:21` `Progress` | Shared with PiP but lives in the fullscreen file and uses `ghost-fs__*` classes. Move it to `Progress.tsx` with neutral classes. |
| D5  | `lyrics/index.tsx:14`, `buttons.ts:14`, `npvCard.tsx:25,52` | `"/lyrics"` is written out in 3 files. Export `ROUTE`. |
| D6  | `settings/store.ts:214`, `windowControls.ts:19` | Windows detection is duplicated. Share one `isWindows`. |
| D7  | `lyrics/index.tsx`, `npvCard.tsx`, `fullscreen.tsx`, `pip.tsx` | Same pattern: create host, `mount`, later unmount and remove host. A `mountIn(parent, element, id)` helper returning one cleanup would shorten each. (Judgement call.) |
| D8  | `lyrics/romanize/korean.ts:80,95` | Magic final indices `21` (ㅇ) and `22` (ㅈ), while `F.h` exists for ㅎ. Add `F.ng`, `F.j`. |
| D9  | `sidebar.ts:33` | The `onDomChange` callback calls `attach()` (which already calls `update()`) and then `update()` again, so two `querySelector`s per frame. |

### Robustness

| ID  | Where | Issue |
| --- | ----- | ----- |
| R1  | `settings/store.ts:127` `persist` | `localStorage.setItem` has no try/catch (other storage calls do); a quota error throws inside a timer. |
| R2  | `lyrics/providers.ts` (all `fetch`es) | No timeouts. Providers run one after another, so a hanging AMLL request keeps the UI on "Loading lyrics…" indefinitely and blocks Spotify/LRCLIB. Add `AbortSignal.timeout(…)`; optionally start AMLL and Spotify in parallel while keeping their priority. |
| R3  | `windowControls.ts:96` | Each (debounced) resize triggers 4 rounds of title-bar calls × 3 APIs. Skip when the zoom factor hasn't changed. |
| R4  | `windowControls.ts:48` `findNativeApi` | A `null` result is cached forever; if it runs before the API is registered, "Hide window buttons" never works this session. Only cache hits. |
| R5  | `background.ts:255` `artColors` | Any single `colorExtractor` failure (even a transient network error) disables it for the session. |
| R6  | `settings/store.ts:181` `applySettings` | `captureBaseColors` is retried only when a setting changes; if `colors.css` isn't readable at startup, tinting stays off until the user touches a setting. |
| R7  | `settings/store.ts:107` `load` | No validation: removed keys are carried along and re-persisted forever, and wrong types or out-of-range values are accepted. Pick only known keys whose type matches the default. |
| R8  | `lyrics/LyricsView.tsx:106` | User scrolling is detected only via wheel/touch/keys. Dragging the scrollbar doesn't pause auto-scroll, so it fights the user. Resizing (e.g. the PiP window) doesn't re-anchor until the next line. |
| R9  | `volume.ts:82` `onWheel` | `wheelAccumulator` never decays: small touchpad deltas spread over minutes eventually trigger a volume step. Reset it after ~200 ms idle. |
| R10 | `lyrics/pip.tsx:27` `copyStylesheets` | Stylesheets are copied once at open. Lazily-added Spotify CSS (and dev rebuilds of `user.css`) don't reach an open PiP window, and `<style>` elements aren't copied at all. |
| R11 | `lyrics/parse.ts:9` `parseTime` | Only `s` offsets are handled; `"500ms"` parses as 500 s. Other clock/offset units yield `NaN`. `parseTTML` also keeps empty `<p>` lines (LRC filters them). |
| R12 | `index.ts:15` | Waits for Spicetify forever with no log. A one-time warning after ~30 s would help diagnose broken installs. |

### Tooling

| ID  | Where | Issue |
| --- | ----- | ----- |
| T1  | — | No tests. `_romanizeTokens` (`japanese.ts:158`) is exported "for tests" but unused. `parse.ts`, `korean.ts` and `kanaToRomaji` are pure and good `node --test` targets. |
| T2  | `build.mjs:72` | `theme.js` isn't written atomically in dev (only `user.css` is), despite the comment's stated reason. Use `write: false` plus an `onEnd` → `writeAtomic`. |
| T3  | `scripts/check-selectors.mjs:78` | Only string *literals* inside `querySelector`/`closest`/… are collected. Selectors held in constants are missed: `BAR` = `.main-nowPlayingBar-volumeBar` (`volume.ts`) isn't used in any CSS, so a Spotify rename would go unreported. |
| T4  | `topbar.tsx:21` | The fallback icon uses `iconMarkup("ghost")` at the default 16px; the React path uses 24px. |

## Function index

Columns: line, name, purpose. The **Notes** column links to findings above.
Inner closures are indented under their parent.

### Entry and wiring

**`src/index.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 5 | `spicetifyReady()` | True once the Spicetify globals Ghost needs exist. | R12 |
| 15 | *(IIFE)* | Polls `spicetifyReady`, then lazy-imports `app` and calls `start()`. | R12 |

**`src/app.tsx`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 11 | `start()` | Adds `html.ghost`, applies settings, runs every `init*`, adds the settings button. | |

**`src/react.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 7 | `mount(element, container)` | Renders with Spotify's ReactDOM (`createRoot` or legacy); returns unmount. | D7 |

**`src/platform.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 34 | `platform()` | `Spicetify.Platform` typed as `GhostPlatform`. | |
| 35 | `history()` | `Platform.History`. | |

**`src/watch.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 9 | `flush()` | Runs every DOM-change callback; clears the queued flag. | |
| 15 | `onDomChange(cb)` | Shared body `childList` observer, batched to one call per animation frame. Returns unsubscribe. | Used by sidebar, volume, npvCard |

**`src/intercept.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 14 | `interceptClick(selector, handle)` | Registers a capture-phase click override; `handle` returning true swallows the click. | |

### Settings

**`src/settings/store.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 107 | `load()` | Reads localStorage, migrates v0.1 `accentFromArt`, merges over `DEFAULTS`. | R7 |
| 121 | `getSettings()` | Current settings snapshot. | |
| 125 | `persist()` | Debounced (250 ms) write to localStorage. | R1 |
| 134 | `setSettings(patch)` | Merge, persist, apply, notify listeners. | |
| 141 | `resetSettings()` | `setSettings(DEFAULTS)`. | B3 |
| 143 | `subscribe(listener)` | Adds a change listener; returns unsubscribe. | |
| 150 | `watchSettings(select, onChange)` | Calls `onChange` only when the selected values change (compared as JSON). | |
| 151 | ↳ `key()` | JSON of the selected values. | |
| 170 | `captureBaseColors(root)` | Copies `--spice-*` surface colours to `--ghost-base-*` once, for tinting. | R6 |
| 178 | `applySettings()` | Writes changed `--ghost-*` variables and toggles `html` classes. | R6, D6 |

**`src/settings/Panel.tsx`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 130 | `UrlInput` | URL field that commits on blur/Enter. | B3 |
| 145 | `Control` | Renders one `ControlDef` (slider/toggle/choice/color/url). | |
| 146 | ↳ `set(value)` | `setSettings({ [key]: value })`. | |
| 194 | `SettingsPanel` | Settings modal body; filters controls by `when`. | |

### Background and accent (`src/background.ts`)

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 25 | `toHttps(url)` | `spotify:image:<id>` → `i.scdn.co` URL. | |
| 35 | `largest(images)` | Picks the biggest image by label. | |
| 37 | ↳ `rank(label)` | Label → size rank. | |
| 46 | `albumArt()` | Best cover URL for the current item. | D1 |
| 61 | `debugBackground()` | Dev snapshot (`ghost.bg()`). | Dev only |
| 82 | `wantedImage(s)` | Image URL for the current source setting ("" = none). | |
| 88 | `loadImage(src, cors)` | Promise for a decoded `<img>`. | |
| 100 | `bake(img, s)` | Blur and colour-adjust into a small canvas, then a blob URL (null if tainted). | |
| 133 | `currentBackground()` | Last announced background (for PiP). | |
| 135 | `onBackgroundChange(listener)` | Subscribe to background changes. | |
| 140 | `announce(image)` | Store and broadcast the shown background. | |
| 145 | `paint(layer, url, live)` | Sets a layer's image; revokes the old blob after 3 s. | |
| 154 | `updateImage()` | Load, bake and crossfade to the wanted image; guards against stale loads. | |
| 191 | `rebake()` | Re-bake the shown image in place (sliders, resize). | |
| 206 | `hexToRgb(hex)` | `#rrggbb` → `[r,g,b]`. | |
| 212 | `luminance(rgb)` | Relative luminance 0–1. | |
| 220 | `setAccent(hex)` | Sets or clears `--spice-button*` accent variables. | |
| 234 | `readable(hex)` | Accent luminance within 0.12–0.85. | |
| 248 | `artColors()` | Candidate colours: `colorExtractor`, falling back to GraphQL `fetchExtractedColors`. | R5 |
| 271 | `artAccent()` | First readable candidate. | |
| 275 | `updateAccent()` | Applies the accent for the `accentSource` setting. | **B2** |
| 290 | `syncFadeTime()` | Matches the crossfade CSS time to Spotify's crossfade pref (at most once a minute). | |
| 309 | `initBackground()` | Creates layers; wires songchange, startup poll, settings watchers, resize. | |
| 320 | ↳ `onSong()` | `updateImage` + `updateAccent` + `syncFadeTime`. | |
| 339 | ↳ `rebakeSoon(delay)` | Debounced `rebake`. | |

### Player bar and chrome

**`src/volume.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 21 | `currentPercent()` | Volume 0–100, or undefined while unknown. | |
| 27 | `setPercent(p)` | Clamp and `Player.setVolume`. | |
| 32 | `update()` | Refresh the label text (unless editing). | |
| 40 | `startEditing()` | Swaps the label for a number input. | |
| 53 | ↳ `finish(apply)` | Commit or cancel the edit. | |
| 82 | `onWheel(e)` | Accumulated wheel → ± step. | R9 |
| 98 | `sync()` | (Re)attach the wheel listener and label to the volume bar. | T3 |
| 113 | `initVolume()` | Volume event, settings watcher, DOM re-attach. | |

**`src/windowControls.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 21 | `setTitlebarHeight(h)` | Sends the native title-bar height through every known API. | |
| 37 | `zoomFactor()` | Spotify UI zoom from `.Root --zoom-level`. | |
| 48 | `findNativeApi()` | Finds the object with `setWindowButtonsVisibility` (cached). | R4 |
| 65 | `applyButtonVisibility()` | Show or hide the native window buttons. | |
| 69 | `apply()` | Button visibility + title-bar height from settings. | |
| 79 | `applyRepeatedly()` | `apply` at 0/500/1500/3000 ms. | R3 |
| 83 | `initWindowControls()` | Windows only: initial apply, settings, resize/fullscreen follow-ups. | D6 |
| 92 | ↳ `later()` | Debounced `applyRepeatedly`. | R3 |

**`src/sidebar.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 15 | `update()` | Toggle `html.ghost-sidebar-collapsed`. | D9 |
| 23 | `attach()` | Observe class changes inside the right sidebar (re-attach if replaced). | D9 |
| 32 | `initSidebarState()` | DOM watcher + initial attach. | D9 |

**`src/npvCanvas.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 11 | `initCanvasClick()` | Swallows click-to-enlarge on the NPV canvas unless enabled. | |

**`src/topbar.tsx`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 10 | `GhostIcon` | 24px ghost icon component. | |
| 12 | `addTopbarButton(label, onClick)` | Spicetify topbar button, rendered as Spotify's `ButtonTertiary`. | T4 |

**`src/icons.tsx`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 25 | `Icon` | SVG icon component. | |
| 34 | `iconMarkup(name, size)` | Same icon as an HTML string. | T4 |

### Lyrics: data

**`src/lyrics/providers.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 16 | `fromAmll(track)` | AMLL TTML by track id. | R2 |
| 27 | `requestSpotifyLyrics(track)` | Spotify color-lyrics via RequestBuilder (CosmosAsync fallback). | |
| 47 | `fromSpotify(track)` | Spotify lyrics → `Lyrics` (drops "♪" lines). | |
| 69 | `fromLrclib(track)` | LRCLIB exact get, then search. | **B8**, R2 |
| 107 | `resolve(track)` | Tries providers in order; reports whether any threw. | R2 |
| 124 | `getLyrics(track)` | Session cache (50, FIFO); errored misses aren't cached. | |
| 137 | `currentTrack()` | `Player.data.item` → `TrackInfo`. | **B1** |

**`src/lyrics/parse.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 9 | `parseTime(value)` | TTML clock/offset → seconds. | R11 |
| 27 | `roleOf(el)` | `ttm:role`. | |
| 31 | `agentOf(el)` | `ttm:agent`. | |
| 37 | `collectWords(parent)` | Timed child spans → words, keeping spacing. | |
| 55 | `vocalFrom(words, fallback)` | Words or text → `Vocal`. | |
| 60 | `parseTTML(xml)` | AMLL TTML → `Lyrics` (duets, background vocals). | R11, T1 |
| 91 | `textWithoutBackground(p)` | Line text minus `x-bg` spans. | |
| 105 | `lrcTime(tag)` | `mm:ss.xx` → seconds. | |
| 111 | `parseLRC(lrc, duration)` | LRC / enhanced LRC → `Lyrics`. | B1, T1 |
| 149 | `staticLyrics(text, provider)` | Plain text → static `Lyrics`. | |

**`src/lyrics/hooks.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 7 | `useCurrentTrack()` | `TrackInfo`, updated on songchange. | |
| 20 | `useLyrics(track)` | Loading/none/ready state for a track. | **B4** |
| 36 | `usePlaying()` | Play state, updated on play/pause. | |

### Lyrics: views

**`src/lyrics/LyricsView.tsx`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 29 | `buildItems(lyrics)` | Lines + interlude items for gaps ≥ 4 s. | |
| 42 | `VocalText` | Text, or per-word spans with `data-start`/`data-end`. | |
| 56 | `offset()` | Lyrics timing setting in seconds. | |
| 59 | `seek(lyricsTime)` | Seek to a line, undoing the offset. | |
| 63 | `LyricsView` | Synced renderer; per-frame work goes straight to the DOM. | R8 |
| 91 | ↳ `setProgress(el, v)` | Writes `--ghost-p` only when changed. | |
| 106 | ↳ `onUserScroll()` | Pauses auto-scroll on user input. | R8 |
| 113 | ↳ `scrollTo(el, smooth)` | Scrolls the current line to its anchor. | |
| 119 | ↳ `tick()` | Frame loop: states, word fill, interludes, distance, scroll. | |

**`src/lyrics/LyricsBody.tsx`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 7 | `LyricsBody` | Loading / none / instrumental message, or `LyricsView`. | B4 |

**`src/lyrics/LyricsPage.tsx`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 10 | `LyricsPage` | Full lyrics page with PiP and fullscreen actions. | D3 |

**`src/lyrics/index.tsx`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 16 | `initLyricsPage()` | Mounts `LyricsPage` over the main view on `/lyrics`. | **B5**, D5, D7 |
| 20 | ↳ `close()` | Unmount and clean up. | |
| 28 | ↳ `sync()` | Mount or unmount for route and setting. | **B5** |
| 51 | `initLyrics()` | Page + card + player buttons. | |

**`src/lyrics/npvCard.tsx`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 17 | `LyricsCard` | Compact synced lyrics in the now-playing view (hidden when static/none). | D3 |
| 44 | `initLyricsCard()` | Places or removes the card host. | D5, D7 |
| 49 | ↳ `place()` | Runs on every DOM change, navigation, setting change. | |

**`src/lyrics/buttons.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 12 | `initPlayerButtons()` | Lyrics button goes back from `/lyrics`; fullscreen button opens Ghost fullscreen. | D5 |

**`src/lyrics/fullscreen.tsx`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 10 | `openFullscreen()` | Mounts `FullscreenView`, hides `.Root`, requests window fullscreen. | D7 |
| 19 | ↳ `onKey(e)` | Esc closes. | |
| 23 | ↳ `onFullscreenChange()` | Leaving window fullscreen closes. | |
| 42 | `closeFullscreen()` | Runs the stored close function once. | |

**`src/lyrics/FullscreenView.tsx`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 13 | `formatTime(ms)` | `m:ss`. | |
| 21 | `Progress` | Per-frame progress bar and times; click to seek. Also used by PiP. | D4 |
| 32 | ↳ `tick()` | Writes only on change. | |
| 48 | ↳ `onSeek(e)` | Click position → seek. | |
| 67 | `FullscreenView` | Cover, meta, progress, controls, lyrics; idle-hides chrome. | D1, D2 |
| 79 | ↳ `wake()` | Resets the 3 s idle timer. | |

**`src/lyrics/pip.tsx`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 21 | `documentPip()` | `window.documentPictureInPicture`. | |
| 23 | `pipSupported()` | Whether the API exists. | |
| 27 | `copyStylesheets(doc)` | Copies `<link rel=stylesheet>` into the PiP document. | R10 |
| 38 | `mirrorRoot(doc)` | Mirrors `html` class/style into PiP; returns stop. | |
| 41 | ↳ `sync()` | One mirror pass. | |
| 51 | `savedSize()` | Last PiP size from localStorage. | |
| 61 | `togglePip()` | Open (styles, mirror, mount) or close; saves size on `pagehide`. | **B7**, D7 |

**`src/lyrics/PipView.tsx`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 12 | `closeWindow(e)` | Closes the window the event came from. | |
| 14 | `useBackground()` | Subscribes to `onBackgroundChange`. | |
| 20 | `PipView` | Background, header, lyrics, hover controls. | D1, D2 |

### Lyrics: romanization

**`src/lyrics/romanize/index.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 15 | `romanize(lyrics, options)` | Classifies lines (Korean/Japanese/Chinese) and romanizes each group. | |
| 31 | ↳ `fill(lines, run, what)` | Runs one romanizer; failures are logged and swallowed. | **B6** |
| 50 | `romanizeCached(lyrics, options)` | Per-lyrics, per-options promise cache. | **B6** |
| 60 | `useRomanized(lyrics)` | Hook: romanized map, or null when off or not ready. | |

**`src/lyrics/romanize/korean.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 54 | `decompose(code)` | Syllable → initial/vowel/final indices. | |
| 60 | `romanizeRun(run)` | Revised Romanization with liaison, nasalisation, ㄹ and ㅎ rules. | D8, T1 |
| 124 | `hasHangul(text)` | Contains Hangul syllables. | |
| 127 | `romanizeKorean(text)` | Romanizes Hangul runs, leaving other text as is. | T1 |

**`src/lyrics/romanize/japanese.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 21 | `withFixedUrls(run)` | Temporarily patches `XMLHttpRequest.open` to fix kuromoji's `https:/` URLs. | |
| 33 | `getTokenizer()` | Loads kuromoji and its dictionary once (retries allowed). | |
| 76 | `toKatakana(s)` | Hiragana → katakana. | |
| 78 | `kanaToRomaji(input)` | Hepburn romaji (sokuon, long vowels, combos). | T1 |
| 106 | `hasKana(text)` | Contains kana. | |
| 107 | `hasJapanese(text)` | Kana or kanji. | |
| 113 | `romanizeTokens(tokens)` | Token readings → spaced romaji; particles, っ merging. | T1 |
| 153 | `romanizeJapanese(lines)` | Tokenize and romanize each line. | |
| 158 | `_romanizeTokens` | Test export; currently unused. | T1 |

**`src/lyrics/romanize/chinese.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 10 | `hasHan(text)` | Contains CJK ideographs (basic block only). | |
| 12 | `romanizeChinese(lines)` | pinyin-pro with tone marks. | |

**`src/lyrics/romanize/load.ts`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 7 | `loadGlobal(url, name)` | Loads a UMD script once and resolves its global; retries after a failure. | B6 |

### Dev tools (`src/dev.ts`, dev builds only)

| Line | Function | Purpose |
| ---: | -------- | ------- |
| 16 | `isHashed(c)` | Heuristic for Spotify's hashed class names. |
| 18 | `classesOf(el)` | Readable vs hashed classes. |
| 26 | `hooksOf(el)` | Stable attributes (testid, aria, …) as selectors. |
| 30 | `inlineStyle(el, max)` | Truncated `style` attribute. |
| 32 | `styleRules(rules)` | Generator over nested style rules. |
| 40 | `sheetRules(sheet)` | All style rules; empty for cross-origin sheets. |
| 49 | `splitSelector(sel)` | Split on top-level commas. |
| 68 | `check(onlyMissing)` | `ghost.check()`: match count per Ghost selector. |
| 93 | `inspect(el)` | `ghost.inspect()`: ancestor table. |
| 109 | `describePaint(el, pseudo)` | Whether an element or pseudo-element paints a background. |
| 119 | `allElementsAt(x, y)` | `elementsFromPoint` including pointer-events:none. |
| 130 | `stackAt(x, y)` | Table of everything under a point. |
| 154 | `pick()` | `ghost.pick()`: click to run `stackAt`. |
| 165 | `rules(term)` | `ghost.rules()`: search loaded selectors. |
| 177 | `classes(term)` | `ghost.classes()`: readable classes in the DOM. |
| 188 | `tree(target, depth, max)` | `ghost.tree()`: compact subtree outline. |
| 216 | `bg()` | `ghost.bg()`: `debugBackground()`. |
| 227 | `installDevTools()` | Exposes `window.ghost`. |

### Build and scripts

**`build.mjs`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 23 | `spicetifyGlobals` (plugin) | Maps react / react-dom / jsx-runtime to Spicetify globals. | |
| 39 | `writeAtomic(path, contents)` | Temp file + rename. | T2 |
| 44 | `buildCss()` | Concatenates `src/styles/*.css` in name order. | |
| 50 | `buildStatic()` | CSS + `color.ini` into `dist/`. | |
| 79 | ↳ `rebuild()` | Debounced static rebuild (dev). | |

**`scripts/check-selectors.mjs`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 18 | `xpuiPath()` | Finds Spotify's xpui folder via the Spicetify config. | |
| 30 | `walk(dir, ext)` | Recursive file list. | |
| 42 | `add(token, kind, from)` | Records a Spotify hook (skips Ghost's own). | T3 |
| 91 | `escape(s)` | Regex escape. | |

**`remote/theme.js`**

| Line | Function | Purpose | Notes |
| ---: | -------- | ------- | ----- |
| 16 | `load(sha)` | Injects `user.css` and `theme.js` from jsDelivr pinned to `sha` (or `@dist`). | |

## Page transitions (measured 2026-09-20)

Measured in the running app over the DevTools protocol (Spotify 1.3.0.277,
Chromium 146), navigating home → album → artist → home with variants
interleaved; medians over 16 navigations each.

| Variant | Old page removed | DOM settled | Style/nav | Layout/nav |
| --- | --- | --- | --- | --- |
| Ghost CSS on | 805 ms | 1958 ms | 111 ms | 564 ms |
| Ghost CSS off | 617 ms | 1756 ms | 52 ms | 297 ms |

What this says:
- Spotify itself removes the old page a few hundred ms after the click and
  renders the new one up to ~300 ms later (first visit); that gap is the "empty"
  moment, and on glass panels there's no opaque page to hide it.
- Ghost's CSS roughly doubles style and layout work per navigation and adds
  ~190 ms before the swap happens — the "stagger".

Fixed: `22-page-transition.css` fades each page in (220 ms), so the gap reads as
a transition instead of a blank panel. Verified in the app: exactly one fade per
navigation, none while typing in search or scrolling.

Still open — where Ghost's per-navigation cost goes:
- `90-accent.css` looked like the main cost in a micro-benchmark (inserting a
  page-sized subtree: 346 ms vs 205 ms), and hoisting its `color-mix()` calls to
  `html.ghost` removed all of that difference. But in real navigations the
  hoisted version measured *slower* (643 ms vs 564 ms to the swap, two runs), so
  it was reverted. The subtree-insert benchmark does not model a real page
  render; don't trust it for this.
- Per-navigation metrics are noisy (±50 ms on the swap, ±50 ms style), so only
  effects larger than that are meaningful. Interleave variants, never compare
  across runs, and warm the page cache first.
- Scripts used for this are in the session scratchpad (`cdp.mjs` + `nav2.mjs`,
  `bisect2.mjs`, `accent4.mjs`); they need Spotify started with
  `--remote-debugging-port=9222`.
