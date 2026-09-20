import { initAccent } from "./accent";
import { initBackground } from "./background";
import { applySettings } from "./settings/store";
import { SettingsPanel } from "./settings/Panel";
import { addTopbarButton } from "./topbar";
import { initWindowControls } from "./windowControls";
import { initVolume } from "./volume";
import { initLyrics } from "./lyrics";
import { initSidebarState } from "./sidebar";
import { initCanvasClick } from "./npvCanvas";

export function start() {
  document.documentElement.classList.add("ghost");
  applySettings();
  initBackground();
  initAccent();
  initWindowControls();
  initVolume();
  initLyrics();
  initSidebarState();
  initCanvasClick();

  addTopbarButton("Ghost settings", () =>
    Spicetify.PopupModal.display({ title: "Ghost", content: <SettingsPanel />, isLarge: true }),
  );
}
