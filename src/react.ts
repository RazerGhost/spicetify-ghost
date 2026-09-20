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

/** Append a new host <div id={id}> to `parent` (in parent's document — also a
 *  picture-in-picture window) and mount `element` into it. `dispose` unmounts
 *  and removes the host. */
export function mountIn(parent: HTMLElement, id: string, element: ReactElement) {
  const host = parent.ownerDocument.createElement("div");
  host.id = id;
  parent.append(host);
  const unmount = mount(element, host);
  return {
    host,
    dispose() {
      unmount();
      host.remove();
    },
  };
}
