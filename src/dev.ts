// Dev-only console helpers (bundled only by `npm run dev`). Open Spotify DevTools
// (`spicetify enable-devtools`, then Ctrl+Shift+I) and use:
//
//   ghost.pick()           click anywhere: lists EVERY element stacked under that
//                          point (even ones covered by others) and what each paints
//   ghost.tree(sel)        compact outline of a subtree (copy(ghost.tree(…)) to share)
//   ghost.bg()             what the background code sees (image candidates, errors)
//   ghost.check()          which user.css selectors match something on this page
//   ghost.inspect($0)      ancestors of the selected element, with stable hooks
//                          (readable classes, data-testid, aria-label…) vs hashed classes
//   ghost.rules("home")    search every selector in Spotify's loaded stylesheets
//   ghost.classes("nav")   readable class names currently in the DOM

// Hashed class names look like "dqwQhIudKoD98eWJzj5E": long, no dashes, mixed case/digits.
const isHashed = (c: string) => c.length >= 12 && !c.includes("-") && /[A-Z]/.test(c) && /[a-z0-9]/.test(c);

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

function ghostSheets(): CSSStyleSheet[] {
  return Array.from(document.styleSheets).filter((s) => s.href?.endsWith("/user.css"));
}

function check(onlyMissing = false) {
  const rows: { selector: string; matches: number | string }[] = [];
  for (const sheet of ghostSheets()) {
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
    const classes = Array.from(node.classList);
    const attrs = ["data-testid", "data-encore-id", "aria-label", "role", "id"]
      .filter((a) => node!.hasAttribute(a))
      .map((a) => `${a}="${node!.getAttribute(a)}"`);
    rows.push({
      tag: node.tagName.toLowerCase(),
      readable: classes.filter((c) => !isHashed(c)).join(" "),
      hashed: classes.filter(isHashed).join(" "),
      attributes: attrs.join(" "),
      inlineStyle: node.getAttribute("style") ?? "",
    });
  }
  console.table(rows);
}

function describePaint(el: Element, pseudo?: string) {
  const cs = getComputedStyle(el, pseudo);
  const bgColor = cs.backgroundColor;
  const bgImage = cs.backgroundImage;
  const paints =
    (bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent") || (bgImage !== "none" && bgImage !== "");
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
  const rows = [];
  const stack = allElementsAt(x, y);
  for (const el of stack) {
    if (el === document.documentElement || el === document.body) continue;
    const classes = Array.from(el.classList);
    const rect = el.getBoundingClientRect();
    const base = {
      tag: el.tagName.toLowerCase(),
      readable: classes.filter((c) => !isHashed(c)).join(" "),
      hashed: classes.filter(isHashed).join(" "),
      size: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
      inlineStyle: (el.getAttribute("style") ?? "").slice(0, 80),
    };
    for (const pseudo of [undefined, "::before", "::after"]) {
      const p = describePaint(el, pseudo);
      if (pseudo && !p.paints) continue;
      rows.push({ ...base, part: pseudo ?? "", ...p, paints: p.paints ? "●" : "" });
    }
  }
  console.table(rows);
  console.info("[ghost] top of the stack first. ● = paints a background. Elements are also in ghost.last.");
  (window as any).ghost.last = stack;
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
  document.querySelectorAll("[class]").forEach((n) => n.classList.forEach((c) => all.add(c)));
  const list = [...all].filter((c) => !isHashed(c) && c.toLowerCase().includes(term.toLowerCase())).sort();
  console.log(list.join("\n"));
  return list.length;
}

// Compact outline of a subtree: tag, readable classes, useful attributes. Repeated
// siblings with the same shape are collapsed ("… ×12"). Returns the text so it
// can be copied: copy(ghost.tree(".main-yourLibraryX-libraryRootlist")).
const TREE_ATTRS = ["role", "aria-selected", "aria-current", "aria-expanded", "aria-label", "data-testid", "data-encore-id", "data-context-menu-open", "href"];

function tree(target: string | Element, depth = 6, maxChildren = 4): string {
  const root = typeof target === "string" ? document.querySelector(target) : target;
  if (!root) return `[ghost] nothing matches ${String(target)}`;
  const lines: string[] = [];
  const label = (el: Element) => {
    const classes = Array.from(el.classList);
    const readable = classes.filter((c) => !isHashed(c)).map((c) => `.${c}`).join("");
    const hashed = classes.filter(isHashed).length;
    const attrs = TREE_ATTRS.filter((a) => el.hasAttribute(a))
      .map((a) => `[${a}="${(el.getAttribute(a) ?? "").slice(0, 40)}"]`)
      .join("");
    const style = el.getAttribute("style") ? `{${el.getAttribute("style")!.slice(0, 60)}}` : "";
    return `${el.tagName.toLowerCase()}${readable}${hashed ? ` (+${hashed} hashed)` : ""}${attrs}${style}`;
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

export function installDevTools() {
  (window as any).ghost = { pick, tree, check, inspect, rules, classes, bg };
  console.info("[ghost] dev helpers ready: ghost.pick(), ghost.tree(sel), ghost.bg(), ghost.inspect($0), ghost.check(), ghost.rules(term), ghost.classes(term)");
}
