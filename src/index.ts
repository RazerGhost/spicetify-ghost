// Entry point. theme.js can run before Spicetify has exposed its APIs, so wait for
// them first. The rest of the theme is pulled in with a dynamic import, which esbuild
// inlines but evaluates lazily — so Spicetify.React is only touched once it exists.

function spicetifyReady(): boolean {
  const s = (window as any).Spicetify as typeof Spicetify | undefined;
  return Boolean(
    s?.React && s.ReactDOM && s.ReactJSX && s.Player && s.Platform && s.PopupModal && s.Topbar,
  );
}

// Dev helpers first and independently, so a startup error can't hide them.
if (__DEV__) import("./dev").then((m) => m.installDevTools());

(async () => {
  const started = Date.now();
  let warned = false;
  while (!spicetifyReady()) {
    await new Promise((r) => setTimeout(r, 100));
    if (!warned && Date.now() - started > 30_000) {
      warned = true;
      console.warn("[ghost] still waiting for Spicetify after 30 s — is Spicetify applied (`spicetify apply`)?");
    }
  }
  const { start } = await import("./app");
  start();
})().catch((err) => console.error("[ghost] failed to start", err));
