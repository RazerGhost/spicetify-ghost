import { useEffect, useState, useSyncExternalStore } from "react";
import { SECTIONS, type ControlDef } from "./schema";
import { DEFAULTS, getSettings, resetSettings, setSettings, subscribe, type Settings } from "./store";

function UrlInput({ value, placeholder, onCommit }: { value: string; placeholder: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  // Follow outside changes (e.g. "Reset to defaults" while the panel is open).
  useEffect(() => setDraft(value), [value]);
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
            step={def.step ?? 1}
            value={s[def.key]}
            onChange={(e) => set(Number(e.currentTarget.value))}
            onDoubleClick={() => set(DEFAULTS[def.key])}
            title="Double-click to reset"
          />
          <output>
            {def.signed && s[def.key] > 0 ? "+" : ""}
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
                <Row key={def.key} className={`ghost-settings__row ghost-settings__row--${def.kind}`}>
                  <span className="ghost-settings__label">
                    {def.label}
                    {def.hint && <small className="ghost-settings__hint">{def.hint}</small>}
                  </span>
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
