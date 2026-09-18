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

export type GhostPlatform = {
  History: SpotifyHistory;
  RequestBuilder?: { build(): RequestChain };
  PlayerAPI?: { _prefs?: { get(query: { key: string }): Promise<{ entries: Record<string, PrefEntry> }> } };
  PlaybackAPI?: { _events?: { addListener(event: string, listener: () => void): void } };
  NativeAPI?: { setWindowButtonsVisibility?(show: boolean): Promise<void> };
  ControlMessageAPI?: { _updateUiClient?: UpdateUiClient };
  UpdateAPI?: { _updateUiClient?: UpdateUiClient };
};

export const platform = (): GhostPlatform => Spicetify.Platform;
export const history = (): SpotifyHistory => platform().History;
