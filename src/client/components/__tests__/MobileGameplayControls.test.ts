/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("mobile gameplay control wiring", () => {
  it("does not mount the lower-left tutorial cue menu", () => {
    const mount = read("src/client/components/biomes_ui/BiomesUIMount.tsx");
    assert.ok(!mount.includes("BiomesUITutorialCueBar"));
  });

  it("attaches input and gameplay focus without Pointer Lock in joystick mode", () => {
    const view = read("src/client/components/BiomesView.tsx");
    assert.ok(
      view.includes("disablePointerLock: clientConfig.showVirtualJoystick")
    );
    assert.ok(view.includes("input.attach(canvas)"));
    assert.ok(view.includes("locked || clientConfig.showVirtualJoystick"));
  });

  it("suppresses the Enter Game pointer-lock overlay in joystick mode", () => {
    const menu = read("src/client/components/EscGameMenu.tsx");
    assert.ok(menu.includes("clientConfig.showVirtualJoystick"));
  });

  it("keeps the movement joystick above the mobile HUD and touch-enabled", () => {
    const joystick = read("src/client/components/JoystickInput.tsx");
    const hud = read("src/client/styles/hud.css");
    assert.ok(joystick.includes('aria-label="Movement joystick"'));
    assert.ok(joystick.includes('data-biomes-mobile-controls="true"'));
    assert.ok(hud.includes("touch-action: none"));
    assert.ok(hud.includes("z-index: 1095"));
  });

  it("keeps joystick walk/run independent from the keyboard run toggle", () => {
    const player = read("src/client/game/scripts/player.ts");
    assert.ok(player.includes("motionWithoutSyntheticSource"));
    assert.ok(player.includes("mobileJoystickRunState !== 0"));
    assert.ok(player.includes("running = mobileJoystickRunState > 0"));
  });

  it("replaces the R/J prompt with mobile-only Menu and Recipes buttons", () => {
    const prompt = read(
      "src/client/components/biomes_ui/BiomesUIOpenPrompt.tsx"
    );
    const ui = read("src/client/components/biomes_ui/BiomesUI.tsx");

    assert.ok(prompt.includes("clientConfig.showVirtualJoystick"));
    assert.ok(
      ui.includes("zIndex: clientConfig.showVirtualJoystick ? 5 : undefined")
    );
    assert.ok(prompt.includes('data-biomes-mobile-menu="true"'));
    assert.ok(prompt.includes(">\n          Menu\n"));
    assert.ok(prompt.includes('aria-label="Open Recipes"'));
    assert.ok(ui.includes('onActiveTabChange("inventory")'));
    assert.ok(
      prompt.includes("BIOMES_UI_QUESTS_SHORTCUT"),
      "desktop keeps its existing R/J prompt"
    );
  });

  it("makes mobile shortcut prompts tappable without leaking into canvas input", () => {
    const shortcut = read("src/client/components/system/ShortcutText.tsx");
    assert.ok(shortcut.includes("key-hint-mobile-action"));
    assert.ok(shortcut.includes("containMobileControlEvent"));
    assert.ok(shortcut.includes("invokeSelectedWorldInteractionForKey"));
    assert.ok(shortcut.includes("onPointerDown"));
    assert.ok(shortcut.includes("event.detail === 0"));
  });

  it("uses compact vital icons and a wider panel only at the mobile breakpoint", () => {
    const vitals = read(
      "src/client/components/biomes_ui/BiomesUIVitalsPanel.tsx"
    );
    const theme = read(
      "src/client/components/biomes_ui/theme/biomesUITheme.ts"
    );
    assert.ok(vitals.includes('tone === "health" ? "♥"'));
    assert.ok(vitals.includes("biomes-ui-vitals-panel--mobile"));
    assert.ok(
      theme.includes(
        ".biomes-ui-vitals-panel--mobile .biomes-ui-vitals-bar__label-text"
      )
    );
    assert.ok(theme.includes("width: min(18rem, calc(100vw - 1rem));"));
  });
});
