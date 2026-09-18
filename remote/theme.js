// Remote loader: installed into Spicetify\Themes\Ghost by `install.ps1`.
//
// jsDelivr serves files with a 7-day browser cache, so plain URLs would keep an
// old version for up to a week. Instead, fetch the tiny version.json uncached
// (written by the GitHub Action), then load theme.js / user.css with ?v=<commit>:
// unchanged version → straight from the browser cache (fast start); new version →
// new URL → fresh download. Offline or slow: fall back to the last known version,
// which the cache still has.
(() => {
  const BASE = "https://cdn.jsdelivr.net/gh/RazerGhost/spicetify-ghost@dist/";
  const KEY = "ghost:remote-version";

  const load = (version) => {
    const query = version ? `?v=${encodeURIComponent(version)}` : "";
    // End of <body>, where Spicetify puts its own user.css, so it outranks
    // Spotify's stylesheets (including ones lazily added to <head> later).
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${BASE}user.css${query}`;
    document.body.appendChild(css);

    const js = document.createElement("script");
    js.src = `${BASE}theme.js${query}`;
    js.onerror = () => console.error("[ghost] could not load remote theme.js");
    document.head.appendChild(js);
  };

  let last = "";
  try {
    last = localStorage.getItem(KEY) || "";
  } catch {}

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  fetch(`${BASE}version.json`, { cache: "no-store", signal: controller.signal })
    .then((res) => (res.ok ? res.json() : null))
    .then((info) => {
      const version = (info && info.v) || last;
      try {
        if (version) localStorage.setItem(KEY, version);
      } catch {}
      load(version);
    })
    .catch(() => load(last))
    .finally(() => clearTimeout(timeout));
})();
