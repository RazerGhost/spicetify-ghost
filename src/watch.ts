// One shared MutationObserver for the theme instead of one per feature, with
// callbacks batched to at most once per animation frame. Spotify mutates the DOM
// constantly (navigation, virtualised lists), so per-mutation work adds up.

const callbacks = new Set<() => void>();
let observer: MutationObserver | null = null;
let queued = false;

function flush() {
  queued = false;
  callbacks.forEach((cb) => cb());
}

/** Run `cb` (at most once per frame) whenever nodes are added or removed anywhere. */
export function onDomChange(cb: () => void): () => void {
  callbacks.add(cb);
  if (!observer) {
    observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(flush);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  return () => callbacks.delete(cb);
}
