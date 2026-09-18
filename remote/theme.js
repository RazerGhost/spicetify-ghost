// Remote loader: installed into Spicetify\Themes\Ghost by `install.ps1`.
//
// Loads theme.js / user.css from jsDelivr *pinned to the latest dist commit*:
//   - branch URLs (@dist) are unreliable right after a push — jsDelivr caches the
//     branch → commit mapping, and it ignores query strings, so "?v=" doesn't help;
//   - commit URLs (@<sha>) are immutable, so jsDelivr and the browser can cache
//     them forever: an unchanged commit starts straight from cache, a new commit
//     is a new URL and downloads immediately.
// The commit comes from the GitHub API (CORS-enabled, 60 requests/hour per IP —
// one per Spotify start). Offline, slow, or rate-limited: use the last known
// commit (still cached). Nothing known yet: fall back to @dist.
(() => {
  const REPO = "RazerGhost/spicetify-ghost";
  const KEY = "ghost:remote-commit";

  const load = (sha) => {
    const base = `https://cdn.jsdelivr.net/gh/${REPO}@${sha || "dist"}/`;
    // End of <body>, where Spicetify puts its own user.css, so it outranks
    // Spotify's stylesheets (including ones lazily added to <head> later).
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${base}user.css`;
    document.body.appendChild(css);

    const js = document.createElement("script");
    js.src = `${base}theme.js`;
    js.onerror = () => console.error("[ghost] could not load remote theme.js");
    document.head.appendChild(js);
  };

  let last = "";
  try {
    last = localStorage.getItem(KEY) || "";
  } catch {}

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  fetch(`https://api.github.com/repos/${REPO}/commits/dist`, {
    headers: { Accept: "application/vnd.github.sha" },
    cache: "no-store",
    signal: controller.signal,
  })
    .then((res) => (res.ok ? res.text() : ""))
    .then((body) => {
      const sha = /^[0-9a-f]{40}$/.test(body.trim()) ? body.trim() : last;
      try {
        if (sha) localStorage.setItem(KEY, sha);
      } catch {}
      load(sha);
    })
    .catch(() => load(last))
    .finally(() => clearTimeout(timeout));
})();
