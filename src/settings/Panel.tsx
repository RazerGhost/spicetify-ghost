import { useState, useSyncExternalStore } from "react";
import { DEFAULTS, getSettings, resetSettings, setSettings, subscribe, type Settings } from "./store";

// Controls are declared as data; <Control> renders each kind.
type KeysOf<T> = { [K in keyof Settings]: Settings[K] extends T ? K : never }[keyof Settings];
type When = (s: Settings) => boolean;

type ControlDef = { label: string; hint?: string; when?: When } & (
  | { kind: "slider"; key: KeysOf<number>; min: number; max: number; unit: string }
  | { kind: "toggle"; key: KeysOf<boolean> }
  | { kind: "choice"; key: KeysOf<string>; options: { value: string; label: string }[] }
  | { kind: "color"; key: KeysOf<string> }
  | { kind: "url"; key: KeysOf<string>; placeholder: string }
);

const notSolid: When = (s) => s.bgSource !== "solid";

const SECTIONS: { title: string; controls: ControlDef[] }[] = [
  {
    title: "Background",
    controls: [
      {
        kind: "choice",
        key: "bgSource",
        label: "Source",
        options: [
          { value: "art", label: "Album art" },
          { value: "custom", label: "Custom image" },
          { value: "solid", label: "Solid colour" },
        ],
      },
      { kind: "url", key: "bgImageUrl", label: "Image URL", placeholder: "https://…", when: (s) => s.bgSource === "custom" },
      { kind: "color", key: "bgColor", label: "Colour", when: (s) => s.bgSource === "solid" },
      { kind: "slider", key: "blur", label: "Blur", min: 0, max: 120, unit: "px", when: notSolid },
      { kind: "slider", key: "brightness", label: "Brightness", min: 0, max: 200, unit: "%", when: notSolid },
      { kind: "slider", key: "saturation", label: "Saturation", min: 0, max: 250, unit: "%", when: notSolid },
      { kind: "slider", key: "contrast", label: "Contrast", min: 0, max: 200, unit: "%", when: notSolid },
      { kind: "toggle", key: "animated", label: "Animated", hint: "Slowly rotating image. Uses more GPU.", when: notSolid },
      { kind: "toggle", key: "grain", label: "Film grain" },
    ],
  },
  {
    title: "Colours",
    controls: [
      {
        kind: "choice",
        key: "accentSource",
        label: "Accent",
        options: [
          { value: "art", label: "From album art" },
          { value: "custom", label: "Custom" },
          { value: "theme", label: "Theme" },
        ],
      },
      { kind: "color", key: "accentColor", label: "Accent colour", when: (s) => s.accentSource === "custom" },
      { kind: "slider", key: "tint", label: "Tint surfaces with accent", min: 0, max: 40, unit: "%", hint: "Mixes the accent into panels, cards and secondary text. 0 = off." },
    ],
  },
  {
    title: "Artist banner",
    controls: [
      {
        kind: "choice",
        key: "bannerMode",
        label: "Banner",
        options: [
          { value: "fade", label: "Fade on scroll" },
          { value: "hide", label: "Hidden" },
        ],
      },
      { kind: "slider", key: "bannerBlur", label: "Banner blur", min: 0, max: 40, unit: "px", when: (s) => s.bannerMode === "fade" },
    ],
  },
  {
    title: "Player bar",
    controls: [
      {
        kind: "choice",
        key: "playerStyle",
        label: "Style",
        options: [
          { value: "floating", label: "Floating card" },
          { value: "plain", label: "Plain" },
        ],
      },
      { kind: "slider", key: "playerWidth", label: "Width", min: 50, max: 100, unit: "%" },
      { kind: "slider", key: "playerHeight", label: "Height", min: 56, max: 96, unit: "px" },
      { kind: "toggle", key: "showVolume", label: "Volume percentage", hint: "Shows the volume next to the slider. Click it to type an exact value." },
      { kind: "slider", key: "volumeStep", label: "Scroll step", min: 1, max: 10, unit: "%", hint: "How much one mouse-wheel notch over the volume bar changes the volume. Shift = 5×." },
    ],
  },
  {
    title: "Lyrics",
    controls: [
      { kind: "toggle", key: "lyricsPage", label: "Replace Spotify's lyrics page", hint: "The lyrics button in the player bar opens these synced lyrics instead of Spotify's." },
      { kind: "slider", key: "lyricsSize", label: "Text size", min: 20, max: 64, unit: "px", when: (s) => s.lyricsPage },
      { kind: "toggle", key: "lyricsBlur", label: "Blur distant lines", when: (s) => s.lyricsPage },
      { kind: "toggle", key: "lyricsCard", label: "Lyrics card in now-playing view", when: (s) => s.lyricsPage },
      { kind: "toggle", key: "replaceFullscreen", label: "Replace Spotify's fullscreen", hint: "The fullscreen button opens the lyrics fullscreen view instead of Spotify's. Esc to exit.", when: (s) => s.lyricsPage },
    ],
  },
  {
    title: "Top bar & library",
    controls: [
      { kind: "toggle", key: "navGlass", label: "Glass top bar", hint: "Turns the top bar into one rounded glass panel." },
      { kind: "toggle", key: "navAutoHide", label: "Auto-hide top bar", hint: "Slides away; hover the top edge to bring it back." },
      { kind: "toggle", key: "slimRail", label: "Slim collapsed library", hint: "Narrower library rail when the library is collapsed." },
      { kind: "toggle", key: "libraryAutoHide", label: "Auto-hide library", hint: "Slides away; hover the left edge to bring it back." },
      { kind: "toggle", key: "hideWindowButtons", label: "Hide window buttons (Windows)", hint: "Hides minimise / maximise / close. Use Win+↓ to minimise, Win+↑ or double-click the top bar to maximise, Alt+F4 to close." },
    ],
  },
  {
    title: "Layout",
    controls: [
      { kind: "slider", key: "panelOpacity", label: "Panel opacity", min: 0, max: 100, unit: "%" },
      { kind: "slider", key: "borderOpacity", label: "Panel border", min: 0, max: 40, unit: "%" },
      { kind: "slider", key: "radius", label: "Corner radius", min: 0, max: 32, unit: "px" },
      { kind: "slider", key: "gap", label: "Panel gap", min: 0, max: 24, unit: "px" },
      { kind: "toggle", key: "fadeEdges", label: "Fade content at edges", hint: "Soft fade at the top and bottom of the main view." },
      { kind: "toggle", key: "hideCollapsedSidebar", label: "Hide collapsed right sidebar", hint: "Removes the leftover strip when the right sidebar is closed." },
      { kind: "toggle", key: "canvasExpand", label: "Enlarge canvas on click", hint: "Spotify's click-to-enlarge on the now-playing video. Its animation stutters, so it's off by default." },
    ],
  },
];

function UrlInput({ value, placeholder, onCommit }: { value: string; placeholder: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      type="url"
      className="ghost-input"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => e.key === "Enter" && onCommit(draft)}
    />
  );
}

function Control({ def, s }: { def: ControlDef; s: Settings }) {
  const set = (value: unknown) => setSettings({ [def.key]: value } as Partial<Settings>);

  switch (def.kind) {
    case "slider":
      return (
        <>
          <input
            type="range"
            min={def.min}
            max={def.max}
            value={s[def.key]}
            onChange={(e) => set(Number(e.currentTarget.value))}
            onDoubleClick={() => set(DEFAULTS[def.key])}
            title="Double-click to reset"
          />
          <output>
            {s[def.key]}
            {def.unit}
          </output>
        </>
      );
    case "toggle":
      return <input type="checkbox" className="ghost-switch" checked={s[def.key]} onChange={(e) => set(e.currentTarget.checked)} />;
    case "choice":
      return (
        <div className="ghost-choice" role="radiogroup">
          {def.options.map((o) => (
            <button
              key={o.value}
              role="radio"
              aria-checked={s[def.key] === o.value}
              className={s[def.key] === o.value ? "ghost-selected" : ""}
              onClick={() => set(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    case "color":
      return <input type="color" className="ghost-color" value={s[def.key]} onChange={(e) => set(e.currentTarget.value)} />;
    case "url":
      return <UrlInput value={s[def.key]} placeholder={def.placeholder} onCommit={set} />;
  }
}

export function SettingsPanel() {
  const s = useSyncExternalStore(subscribe, getSettings);

  return (
    <div className="ghost-settings">
      {SECTIONS.map((section) => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          {section.controls
            .filter((def) => !def.when || def.when(s))
            .map((def) => {
              // A <label> forwards clicks to the first button inside it, so the
              // button-group row must not be one.
              const Row = def.kind === "choice" ? "div" : "label";
              return (
                <Row key={def.key} className={`ghost-settings__row ghost-settings__row--${def.kind}`} title={def.hint}>
                  <span>{def.label}</span>
                  <Control def={def} s={s} />
                </Row>
              );
            })}
        </section>
      ))}

      <button className="ghost-settings__reset" onClick={resetSettings}>
        Reset to defaults
      </button>
    </div>
  );
}
