// Mount React elements with Spotify's own ReactDOM (Spicetify.ReactDOM).
// Prefer createRoot; fall back to legacy render (what Spicetify's PopupModal uses).
// Returns an unmount function.

import type { ReactElement } from "react";

export function mount(element: ReactElement, container: HTMLElement): () => void {
  const ReactDOM = Spicetify.ReactDOM as any;
  if (typeof ReactDOM.createRoot === "function") {
    const root = ReactDOM.createRoot(container);
    root.render(element);
    return () => root.unmount();
  }
  ReactDOM.render(element, container);
  return () => ReactDOM.unmountComponentAtNode(container);
}
