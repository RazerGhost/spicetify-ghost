// All of Ghost's icons in one place: SVG path data plus a small component.

export const ICON_PATHS = {
  // 24×24
  ghost:
    "M12 2a8 8 0 0 0-8 8v11.2c0 .6.7 1 1.2.6l1.9-1.5 1.9 1.5c.3.3.8.3 1.1 0L12 20.3l1.9 1.5c.3.3.8.3 1.1 0l1.9-1.5 1.9 1.5c.5.4 1.2 0 1.2-.6V10a8 8 0 0 0-8-8Zm-3 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z",
  // 16×16
  expand:
    "M1.5 1h4v1.5H3.56l3 3-1.06 1.06-3-3V5.5H1V1.5A.5.5 0 0 1 1.5 1Zm13 0a.5.5 0 0 1 .5.5v4h-1.5V3.56l-3 3-1.06-1.06 3-3H10.5V1h4ZM2.5 12.44l3-3 1.06 1.06-3 3H5.5V15h-4a.5.5 0 0 1-.5-.5v-4h1.5v1.94Zm12.5-1.94v4a.5.5 0 0 1-.5.5h-4v-1.5h1.94l-3-3 1.06-1.06 3 3V10.5H15Z",
  play: "M3 1.7v12.6a.7.7 0 0 0 1.05.6l10.9-6.3a.7.7 0 0 0 0-1.2L4.05 1.1A.7.7 0 0 0 3 1.7Z",
  pause:
    "M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7Zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6Z",
  next: "M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.1A.7.7 0 0 0 1 1.7v12.6a.7.7 0 0 0 1.05.6L12 9.15v5.15a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-1.6Z",
  prev: "M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.75a.7.7 0 0 1 1.05.6v12.6a.7.7 0 0 1-1.05.6L4 9.15v5.15a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7h1.6Z",
  close:
    "M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 1 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06Z",
};

export type IconName = keyof typeof ICON_PATHS;

const VIEWBOX: Partial<Record<IconName, string>> = { ghost: "0 0 24 24" };

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox={VIEWBOX[name] ?? "0 0 16 16"} width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/** Same icon as an HTML string, for places that take markup instead of React. */
export const iconMarkup = (name: IconName, size = 16) =>
  `<svg viewBox="${VIEWBOX[name] ?? "0 0 16 16"}" width="${size}" height="${size}" fill="currentColor"><path d="${ICON_PATHS[name]}"/></svg>`;
