// Take over clicks on Spotify's own controls. One capture-phase listener on
// document runs before React's handlers (which sit on the app root), so a
// handler that returns true means Spotify never sees the click.

type Handler = {
  selector: string;
  /** Return true to swallow the click (Spotify's own handler won't run). */
  handle(target: Element, event: MouseEvent): boolean;
};

const handlers: Handler[] = [];
let installed = false;

export function interceptClick(selector: string, handle: Handler["handle"]) {
  handlers.push({ selector, handle });
  if (installed) return;
  installed = true;
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element | null;
      if (!target?.closest) return;
      for (const h of handlers) {
        const match = target.closest(h.selector);
        if (match && h.handle(target, e)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    },
    true,
  );
}
