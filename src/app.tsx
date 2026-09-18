import { initBackground } from "./background";
import { applySettings } from "./settings/store";
import { SettingsPanel } from "./settings/Panel";
import { addTopbarButton } from "./topbar";
import { initWindowControls } from "./windowControls";
import { initVolume } from "./volume";
import { initLyrics } from "./lyrics";

export function start() {
  document.documentElement.classList.add("ghost");
  applySettings();
  initBackground();
  initWindowControls();
  initVolume();
  initLyrics();

  addTopbarButton("Ghost settings", () =>
    Spicetify.PopupModal.display({ title: "Ghost", content: <SettingsPanel />, isLarge: true }),
  );
}
