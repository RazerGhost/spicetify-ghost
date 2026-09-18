// Remote loader: installed into Spicetify\Themes\Ghost by `install.ps1`.
// Pulls the real theme from the `dist` branch, so a push to main (built by CI)
// updates every installation on the next Spotify start.
(() => {
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/gh/RazerGhost/spicetify-ghost@dist/theme.js";
  s.onerror = () => console.error("[ghost] could not load remote theme.js");
  document.head.appendChild(s);
})();
