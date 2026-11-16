// Typed view of the Spotify-internal APIs Ghost uses. Spicetify declares
// Spicetify.Platform as `any`; this describes just the parts we touch (as found
// in xpui-modules.js / spicetifyWrapper.js), optional where builds differ.

export type SpotifyHistory = {
  location: { pathname: string };
  listen(listener: () => void): () => void;
  push(path: string): void;
  goBack(): void;
};

type RequestChain = {
  withHost(host: string): RequestChain;
  withPath(path: string): RequestChain;
  withQueryParameters(params: Record<string, string | boolean>): RequestChain;
  withEndpointIdentifier(id: string): RequestChain;
  send(): Promise<{ body: any }>;
};

type PrefEntry = { bool?: boolean; number?: number };

type UpdateUiClient = { updateTitlebarHeight?(msg: { height: number }): Promise<unknown> };

/** Spotify's desktop window service. States: 1 normal, 2 maximized, 3 minimized, 4 hidden. */
type WindowStateClient = {
  setWindowState?(msg: { state: number }): Promise<unknown>;
  closeWindow?(msg: Record<string, never>): Promise<unknown>;
};

export type GhostPlatform = {
  History: SpotifyHistory;
  RequestBuilder?: { build(): RequestChain };
  PlayerAPI?: { _prefs?: { get(query: { key: string }): Promise<{ entries: Record<string, PrefEntry> }> } };
  PlaybackAPI?: { _events?: { addListener(event: string, listener: () => void): void } };
  NativeAPI?: { setWindowButtonsVisibility?(show: boolean): Promise<void> };
  FocusMainWindowAPI?: { _windowStateClient?: WindowStateClient };
  ControlMessageAPI?: { _updateUiClient?: UpdateUiClient };
  UpdateAPI?: { _updateUiClient?: UpdateUiClient };
};

export const isWindows = navigator.userAgent.includes("Windows");
export const isLinux = navigator.userAgent.includes("Linux") && !navigator.userAgent.includes("Android");

export const platform = (): GhostPlatform => Spicetify.Platform;

/** True when Spotify is at least `min` (e.g. "1.3.9"); compares numerically
 *  part by part ("1.3.9.2055"). False when the version is unknown. */
export function spotifyAtLeast(min: string): boolean {
  const version: unknown = (Spicetify.Platform as { version?: unknown } | undefined)?.version;
  if (typeof version !== "string") return false;
  const have = version.split(".").map(Number);
  const want = min.split(".").map(Number);
  for (let i = 0; i < want.length; i++) {
    const h = have[i] ?? 0;
    if (!Number.isFinite(h)) return false;
    if (h !== want[i]) return h > want[i];
  }
  return true;
}
export const history = (): SpotifyHistory => platform().History;
