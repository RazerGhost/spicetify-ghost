// Dev-only console helpers (bundled only by `npm run dev`). Open Spotify DevTools
// (`spicetify enable-devtools`, then Ctrl+Shift+I) and use:
//
//   ghost.pick()           click anywhere: every element stacked under that point
//                          (even covered / click-through ones) and what each paints
//   ghost.tree(sel)        compact outline of a subtree (copy(ghost.tree(…)) to share)
//   ghost.inspect($0)      ancestors of an element: readable vs hashed classes, hooks
//   ghost.bg()             what the background code sees (image candidates, errors)
//   ghost.check()          how many elements each Ghost selector matches on this page
//   ghost.rules("home")    search every selector in Spotify's loaded stylesheets
//   ghost.classes("nav")   readable class names currently in the DOM

// --- shared --------------------------------------------------------------------

// Hashed class names look like "dqwQhIudKoD98eWJzj5E": long, no dashes, mixed case/digits.
const isHashed = (c: string) => c.length >= 12 && !c.includes("-") && /[A-Z]/.test(c) && /[a-z0-9]/.test(c);

function classesOf(el: Element) {
  const all = Array.from(el.classList);
  return { readable: all.filter((c) => !isHashed(c)), hashed: all.filter(isHashed) };
}

/** Stable hooks worth knowing about when writing a selector. */
const HOOK_ATTRS = ["data-testid", "data-encore-id", "role", "aria-label", "aria-selected", "aria-current", "aria-expanded", "id", "href"];

function hooksOf(el: Element, max = 40) {
  return HOOK_ATTRS.filter((a) => el.hasAttribute(a)).map((a) => `[${a}="${(el.getAttribute(a) ?? "").slice(0, max)}"]`);
}

const inlineStyle = (el: Element, max: number) => (el.getAttribute("style") ?? "").slice(0, max);

function* styleRules(rules: CSSRuleList): Generator<CSSStyleRule> {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) yield rule;
    else if (rule instanceof CSSImportRule && rule.styleSheet) yield* styleRules(rule.styleSheet.cssRules);
    else if ("cssRules" in rule) yield* styleRules((rule as CSSGroupingRule).cssRules);
  }
}

function sheetRules(sheet: CSSStyleSheet): CSSStyleRule[] {
  try {
    return [...styleRules(sheet.cssRules)];
  } catch {
    return []; // cross-origin sheet
  }
}

// Split "a, b:is(c, d)" on top-level commas only.
function splitSelector(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(selector.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(selector.slice(start).trim());
  return parts;
}

// --- helpers -----------------------------------------------------------------------

function check(onlyMissing = false) {
  // pathname, not href: the remote loader adds ?v=<version>.
  const ghostSheets = Array.from(document.styleSheets).filter(
    (s) => s.href && new URL(s.href).pathname.endsWith("/user.css"),
  );
  const rows: { selector: string; matches: number | string }[] = [];
  for (const sheet of ghostSheets) {
    for (const rule of sheetRules(sheet)) {
      for (const selector of splitSelector(rule.selectorText)) {
        // Pseudo-elements never match querySelectorAll; test the element they hang off.
        const testable = selector.replace(/::?(before|after|selection|placeholder|-webkit-[\w-]+)\b/g, "") || "*";
        let matches: number | string;
        try {
          matches = document.querySelectorAll(testable).length;
        } catch {
          matches = "invalid";
        }
        if (!onlyMissing || matches === 0) rows.push({ selector, matches });
      }
    }
  }
  console.table(rows);
  console.info("[ghost] 0 = nothing on *this page* — navigate and re-run before calling it broken.");
}

function inspect(el?: Element | null) {
  if (!el) return console.warn("[ghost] pass an element, e.g. ghost.inspect($0)");
  const rows = [];
  for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
    const { readable, hashed } = classesOf(node);
    rows.push({
      tag: node.tagName.toLowerCase(),
      readable: readable.join(" "),
      hashed: hashed.join(" "),
      hooks: hooksOf(node).join(" "),
      inlineStyle: inlineStyle(node, 120),
    });
  }
  console.table(rows);
}

function describePaint(el: Element, pseudo?: string) {
  const cs = getComputedStyle(el, pseudo);
  const bgColor = cs.backgroundColor;
  const bgImage = cs.backgroundImage;
  const paints = (bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent") || (bgImage !== "none" && bgImage !== "");
  return { paints, bgColor, bgImage: bgImage.length > 90 ? `${bgImage.slice(0, 90)}…` : bgImage, opacity: cs.opacity };
}

// elementsFromPoint skips pointer-events:none elements — which is exactly what
// background layers use — so force pointer events on for the duration of the lookup.
function allElementsAt(x: number, y: number): Element[] {
  const style = document.createElement("style");
  style.textContent = "*, *::before, *::after { pointer-events: auto !important; }";
  document.head.append(style);
  try {
    return document.elementsFromPoint(x, y);
  } finally {
    style.remove();
  }
}

function stackAt(x: number, y: number) {
  const stack = allElementsAt(x, y).filter((el) => el !== document.documentElement && el !== document.body);
  const rows = [];
  for (const el of stack) {
    const { readable, hashed } = classesOf(el);
    const rect = el.getBoundingClientRect();
    const base = {
      tag: el.tagName.toLowerCase(),
      readable: readable.join(" "),
      hashed: hashed.join(" "),
      size: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
      inlineStyle: inlineStyle(el, 80),
    };
    for (const pseudo of [undefined, "::before", "::after"]) {
      const p = describePaint(el, pseudo);
      if (pseudo && !p.paints) continue;
      rows.push({ ...base, part: pseudo ?? "", ...p, paints: p.paints ? "●" : "" });
    }
  }
  console.table(rows);
  console.info("[ghost] top of the stack first. ● = paints a background. Elements are in ghost.last.");
  api.last = stack;
}

function pick() {
  console.info("[ghost] click anywhere in Spotify (the click won't reach the app)…");
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener("click", onClick, true);
    stackAt(e.clientX, e.clientY);
  };
  window.addEventListener("click", onClick, true);
}

function rules(term: string) {
  const needle = term.toLowerCase();
  const found = new Map<string, string>();
  for (const sheet of Array.from(document.styleSheets)) {
    const file = sheet.href?.split("/").pop() ?? "<style>";
    for (const rule of sheetRules(sheet)) {
      if (rule.selectorText.toLowerCase().includes(needle)) found.set(rule.selectorText, file);
    }
  }
  console.table([...found].map(([selector, file]) => ({ selector, file })));
}

function classes(term = "") {
  const all = new Set<string>();
  document.querySelectorAll("[class]").forEach((n) => classesOf(n).readable.forEach((c) => all.add(c)));
  const list = [...all].filter((c) => c.toLowerCase().includes(term.toLowerCase())).sort();
  console.log(list.join("\n"));
  return list.length;
}

// Compact outline of a subtree: tag, readable classes (+ hashed count), hooks and
// inline style; beyond `maxChildren` siblings it prints "… +N more". Returns the
// text so it can be copied: copy(ghost.tree(".main-yourLibraryX-libraryRootlist")).
function tree(target: string | Element, depth = 6, maxChildren = 4): string {
  const root = typeof target === "string" ? document.querySelector(target) : target;
  if (!root) return `[ghost] nothing matches ${String(target)}`;
  const lines: string[] = [];
  const label = (el: Element) => {
    const { readable, hashed } = classesOf(el);
    const style = inlineStyle(el, 60);
    return (
      el.tagName.toLowerCase() +
      readable.map((c) => `.${c}`).join("") +
      (hashed.length ? ` (+${hashed.length} hashed)` : "") +
      hooksOf(el).join("") +
      (style ? `{${style}}` : "")
    );
  };
  const walk = (el: Element, level: number) => {
    lines.push(`${"  ".repeat(level)}${label(el)}`);
    if (level >= depth) return;
    const kids = Array.from(el.children);
    kids.slice(0, maxChildren).forEach((k) => walk(k, level + 1));
    if (kids.length > maxChildren) lines.push(`${"  ".repeat(level + 1)}… +${kids.length - maxChildren} more`);
  };
  walk(root, 0);
  const text = lines.join("\n");
  console.log(text);
  return text;
}

async function bg() {
  const { debugBackground } = await import("./background");
  const info = debugBackground();
  console.log(info);
  return info;
}

// --- install ---------------------------------------------------------------------

const api: Record<string, unknown> = { pick, tree, inspect, bg, check, rules, classes };

export function installDevTools() {
  (window as unknown as { ghost: typeof api }).ghost = api;
  const names = Object.keys(api).map((n) => `ghost.${n}()`);
  console.info(`[ghost] dev helpers ready: ${names.join(", ")}`);
}
