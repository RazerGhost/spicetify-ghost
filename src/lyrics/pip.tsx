// Picture-in-picture lyrics: a small always-on-top window (Document Picture-in-
// Picture — the API Spotify's own mini player uses, see xpui-modules.js) that
// keeps working while Spotify is minimised.
//
// The PiP window is a separate document, so it gets live copies of the page's
// stylesheets (Ghost, Spotify colours, fonts) and a live mirror of <html>'s
// classes and inline variables (accent, tint, settings). React renders into it
// with Spotify's own ReactDOM, like everything else.

import { mountIn } from "../react";
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
/** True while requestWindow is pending — a second click then does nothing. */
let opening = false;

const SHEETS = 'link[rel="stylesheet"], style';
const isSheet = (n: Node) => n.nodeName === "LINK" || n.nodeName === "STYLE";

/** Keep copies of the page's stylesheets in the PiP document, in the same order
 *  (Ghost's user.css must stay last), including ones Spotify adds lazily later.
 *  <style> contents are copied once; rules added through the CSSOM aren't.
 *  Returns a stop function. */
function mirrorStylesheets(target: Document) {
  const copies = new Map<Element, Element>();
  const sync = () => {
    const current = Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(SHEETS));
    const present = new Set<Element>(current);
    for (const [src, copy] of copies) {
      if (present.has(src)) continue;
      copy.remove();
      copies.delete(src);
    }
    let added = false;
    for (const src of current) {
      if (copies.has(src)) continue;
      if (src instanceof HTMLLinkElement) {
        const link = target.createElement("link");
        link.rel = "stylesheet";
        link.href = src.href; // absolute, so it resolves from the PiP document too
        copies.set(src, link);
      } else {
        const style = target.createElement("style");
        style.textContent = src.textContent;
        copies.set(src, style);
      }
      added = true;
    }
    // (Re)append in document order; moving an already loaded sheet is cheap.
    if (added) for (const src of current) target.head.append(copies.get(src)!);
  };
  sync();
  const observer = new MutationObserver((records) => {
    if (records.some((r) => Array.from(r.addedNodes).some(isSheet) || Array.from(r.removedNodes).some(isSheet))) sync();
  });
  // user.css is appended to <body> (by Spicetify and the remote loader).
  observer.observe(document.head, { childList: true });
  observer.observe(document.body, { childList: true });
  return () => observer.disconnect();
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
  if (!api || opening) return;

  let win: Window;
  opening = true;
  try {
    win = await api.requestWindow(savedSize());
  } catch (err) {
    console.warn("[ghost] couldn't open picture-in-picture", err);
    return;
  } finally {
    opening = false;
  }
  pipWindow = win;
  const doc = win.document;
  doc.title = "Ghost Lyrics";
  doc.body.style.margin = "0";
  const stopSheets = mirrorStylesheets(doc);
  const stopMirror = mirrorRoot(doc);

  const view = mountIn(doc.body, "ghost-pip-host", <PipView />);

  win.addEventListener(
    "pagehide",
    () => {
      try {
        localStorage.setItem(SIZE_KEY, JSON.stringify({ width: win.innerWidth, height: win.innerHeight }));
      } catch {}
      stopSheets();
      stopMirror();
      view.dispose();
      // Only if it's still ours: opening a new PiP window closes the old one.
      if (pipWindow === win) pipWindow = null;
    },
    { once: true },
  );
}
