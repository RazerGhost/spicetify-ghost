// Picture-in-picture lyrics: a small always-on-top window (Document Picture-in-
// Picture — the API Spotify's own mini player uses, see xpui-modules.js) that
// keeps working while Spotify is minimised.
//
// The PiP window is a separate document, so it gets copies of the page's
// stylesheets (Ghost, Spotify colours, fonts) and a live mirror of <html>'s
// classes and inline variables (accent, tint, settings). React renders into it
// with Spotify's own ReactDOM, like everything else.

import { mount } from "../react";
import { PipView } from "./PipView";

type DocumentPip = {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
  window: Window | null;
};

const SIZE_KEY = "ghost:pip-size";
const DEFAULT_SIZE = { width: 360, height: 480 };

const documentPip = () => (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture;

export const pipSupported = () => !!documentPip();

let pipWindow: Window | null = null;

function copyStylesheets(target: Document) {
  for (const link of Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))) {
    const copy = target.createElement("link");
    copy.rel = "stylesheet";
    copy.href = link.href; // absolute, so it resolves from the PiP document too
    target.head.append(copy);
  }
}

/** Keep the PiP <html> in sync with the main one (settings classes, --ghost-*
 *  variables, accent). Returns a stop function. */
function mirrorRoot(target: Document) {
  const src = document.documentElement;
  const dst = target.documentElement;
  const sync = () => {
    dst.className = src.className;
    dst.setAttribute("style", src.getAttribute("style") ?? "");
  };
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(src, { attributes: true, attributeFilter: ["class", "style"] });
  return () => observer.disconnect();
}

function savedSize() {
  try {
    const size = JSON.parse(localStorage.getItem(SIZE_KEY) ?? "null");
    if (size?.width > 100 && size?.height > 100) return size as typeof DEFAULT_SIZE;
  } catch {}
  return DEFAULT_SIZE;
}

/** Open the PiP window, or close it if it's already open. Must run from a click
 *  (browsers only allow requestWindow with user activation). */
export async function togglePip() {
  if (pipWindow) {
    pipWindow.close();
    return;
  }
  const api = documentPip();
  if (!api) return;

  let win: Window;
  try {
    win = await api.requestWindow(savedSize());
  } catch (err) {
    console.warn("[ghost] couldn't open picture-in-picture", err);
    return;
  }
  pipWindow = win;
  const doc = win.document;
  doc.title = "Ghost Lyrics";
  doc.body.style.margin = "0";
  copyStylesheets(doc);
  const stopMirror = mirrorRoot(doc);

  const host = doc.createElement("div");
  host.id = "ghost-pip-host";
  doc.body.append(host);
  const unmount = mount(<PipView />, host);

  win.addEventListener(
    "pagehide",
    () => {
      try {
        localStorage.setItem(SIZE_KEY, JSON.stringify({ width: win.innerWidth, height: win.innerHeight }));
      } catch {}
      stopMirror();
      unmount();
      pipWindow = null;
    },
    { once: true },
  );
}
