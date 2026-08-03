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

  it("attaches input and gameplay focus on every pointerless control path", () => {
    const view = read("src/client/components/BiomesView.tsx");
    const pointerLock = read(
      "src/client/components/contexts/PointerLockContext.ts"
    );
    assert.ok(
      view.includes(
        "clientConfig.showVirtualJoystick || !supportsPointerLock()"
      )
    );
    assert.ok(view.includes("disablePointerLock: initialPointerlessGameplay"));
    assert.ok(view.includes("input.attach(canvas)"));
    assert.ok(view.includes("locked || pointerlessGameplay"));
    assert.ok(view.includes("pointerLockManager.isPointerLockDisabled()"));
    assert.ok(pointerLock.includes("pointerLockDisabledChange"));
    assert.ok(pointerLock.includes("this.setPointerLockDisabled(true)"));
  });

  it("does not classify a pointerless desktop browser as mobile", () => {
    const config = read("src/client/game/client_config.ts");
    assert.ok(config.includes("void pointerLockSupported"));
    assert.ok(!config.includes("!pointerLockSupported ||\n    touchDevice"));
  });

  it("unlocks Web Audio from the canvas click before requesting pointer lock", () => {
    const view = read("src/client/components/BiomesView.tsx");
    const clickHandler = view.indexOf("click: (e) => {");
    const audioResume = view.indexOf(
      "void audioManager.resumeAudio();",
      clickHandler
    );
    const pointerLockRequest = view.indexOf(
      "pointerLockManager.focusAndLock();",
      clickHandler
    );

    assert.ok(clickHandler >= 0, "canvas click handler is missing");
    assert.ok(
      audioResume > clickHandler,
      "canvas click does not synchronously request Web Audio resume"
    );
    assert.ok(
      pointerLockRequest > audioResume,
      "Pointer Lock is requested before the Web Audio unlock"
    );
  });

  it("suppresses the Enter Game pointer-lock overlay in joystick mode", () => {
    const menu = read("src/client/components/EscGameMenu.tsx");
    assert.ok(menu.includes("clientConfig.showVirtualJoystick"));
    assert.ok(menu.includes("pointerLockDisabled"));
  });

  it("keeps the movement joystick above the mobile HUD and touch-enabled", () => {
    const joystick = read("src/client/components/JoystickInput.tsx");
    const hud = read("src/client/styles/hud.css");
    assert.ok(joystick.includes('aria-label="Movement joystick"'));
    assert.ok(joystick.includes("clientConfig.mobileDevice"));
    assert.ok(joystick.includes("joysticks--mobile"));
    assert.ok(joystick.includes("data-biomes-mobile-controls={"));
    assert.ok(hud.includes("touch-action: none"));
    assert.ok(hud.includes("z-index: 1095"));
  });

  it("adds directional double-tap evade plus contained crouch and jump controls", () => {
    const joystick = read("src/client/components/JoystickInput.tsx");
    const input = read("src/client/game/context_managers/input.ts");
    const player = read("src/client/game/scripts/player.ts");
    const hud = read("src/client/styles/hud.css");

    assert.ok(joystick.includes("if (!clientConfig.showVirtualJoystick)"));
    assert.ok(joystick.includes("return <JoystickInput />"));
    assert.ok(joystick.includes('data-biomes-mobile-double-tap-dodge="true"'));
    assert.ok(joystick.includes("pulseAction(command.action"));
    assert.ok(joystick.includes('data-biomes-mobile-crouch="true"'));
    assert.ok(joystick.includes('data-biomes-mobile-jump="true"'));
    assert.ok(joystick.includes('aria-label="Hold C to crouch"'));
    assert.ok(joystick.includes('aria-label="Jump or hold to rise"'));
    assert.ok(joystick.includes("clientConfig.mobileDevice ? ("));
    assert.ok(joystick.includes("MOBILE_JOYSTICK_JUMP_SOURCE"));
    assert.match(joystick, /input\.setSyntheticAction\(\s*"jump"/);
    assert.ok(joystick.includes("containMobileControlEvent"));
    assert.ok(input.includes("setSyntheticAction"));
    assert.ok(player.includes("MOBILE_JOYSTICK_CROUCH_SOURCE"));
    assert.ok(player.includes("motionWithoutSyntheticSource"));
    assert.ok(hud.includes(".mobile-movement-button"));
    assert.ok(hud.includes(".mobile-jump-button"));
    assert.ok(hud.includes("touch-action: none"));
  });

  it("keeps mobile loading and character previews within the WebGL budget", () => {
    const particles = read("src/client/components/Particles.tsx");
    const wakeup = read("src/client/components/WakeUpScreen.tsx");
    const preview = read(
      "src/client/components/object_preview_render_scale.ts"
    );

    assert.ok(particles.includes("retina_detect: !touchDevice"));
    assert.ok(particles.includes("value: touchDevice ? 16 : 40"));
    assert.ok(
      wakeup.includes('clientConfig.lowMemory ? "static-icon" : "live-webgl"')
    );
    assert.ok(preview.includes("lowMemory ? Math.min(1, devicePixelRatio)"));
  });

  it("uses the phone memory profile and does not mount streaming media players", () => {
    const config = read("src/client/game/client_config.ts");
    const spatialMedia = read("src/client/components/SpatialMediaPlayer.tsx");
    const css3dTv = read("src/client/components/css3d/CSS3DTV.tsx");

    assert.ok(config.includes("MOBILE_VOXELOO_MEMORY_SCALE = 0.25"));
    assert.ok(config.includes("ret.forceRenderScale = 0.5"));
    assert.ok(spatialMedia.includes("clientConfig.mobileDevice"));
    assert.ok(css3dTv.includes("mobileStaticMedia"));
  });

  it("keeps joystick walk/run independent from the keyboard run toggle", () => {
    const player = read("src/client/game/scripts/player.ts");
    assert.ok(player.includes("motionWithoutSyntheticSource"));
    assert.ok(player.includes("mobileJoystickRunState !== 0"));
    assert.ok(player.includes("running = mobileJoystickRunState > 0"));
  });

  it("replaces the R/J prompt with mobile Menu, Recipes, and Invite buttons", () => {
    const prompt = read(
      "src/client/components/biomes_ui/BiomesUIOpenPrompt.tsx"
    );
    const ui = read("src/client/components/biomes_ui/BiomesUI.tsx");

    assert.ok(prompt.includes("clientConfig.showVirtualJoystick"));
    assert.ok(ui.includes("const phoneLayout = clientConfig.mobileDevice"));
    assert.ok(ui.includes("zIndex: phoneLayout ? 5 : undefined"));
    assert.ok(prompt.includes('data-biomes-mobile-menu="true"'));
    assert.ok(prompt.includes('data-biomes-mobile-action="menu"'));
    assert.ok(prompt.includes('data-biomes-mobile-action="recipes"'));
    assert.ok(prompt.includes('data-biomes-mobile-action="invite"'));
    assert.ok(prompt.includes('aria-label="Open Recipes"'));
    assert.ok(prompt.includes('aria-label="Invite friends"'));
    assert.ok(ui.includes('onActiveTabChange("inventory")'));
    assert.ok(
      ui.includes(
        "hudVisibility.helpButtons || clientConfig.showVirtualJoystick"
      )
    );
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
    assert.ok(vitals.includes('law: "⚖"'));
    assert.ok(vitals.includes('notoriety: "◉"'));
    assert.ok(vitals.includes("biomes-ui-vitals-chip__icon--gold"));
    assert.ok(vitals.includes("biomes-ui-vitals-chip__icon--level"));
    assert.ok(vitals.includes("biomes-ui-vitals-panel--mobile"));
    assert.ok(
      theme.includes(
        ".biomes-ui-vitals-panel--mobile .biomes-ui-vitals-bar__label-text"
      )
    );
    assert.ok(theme.includes("width: min(54vw, 320px);"));
  });

  it("keeps phone layout changes scoped away from pointerless desktop", () => {
    const ui = read("src/client/components/biomes_ui/BiomesUI.tsx");
    const nav = read("src/client/components/biomes_ui/nav/BiomesNav.tsx");
    const hotbar = read(
      "src/client/components/biomes_ui/hotbar/BiomesHotbar.tsx"
    );
    const theme = read(
      "src/client/components/biomes_ui/theme/biomesUITheme.ts"
    );

    assert.ok(ui.includes("biomes-ui-hotbar-hud--mobile"));
    assert.ok(ui.includes("data-biomes-mobile-hotbar"));
    assert.ok(hotbar.includes('mobile ? "pan-x" : undefined'));
    assert.ok(theme.includes(".biomes-ui-hotbar-hud--mobile"));
    assert.ok(
      theme.includes(
        "bottom: max(28px, calc(env(safe-area-inset-bottom) + 16px));"
      )
    );
    assert.ok(theme.includes("clamp(136px, 32vw, 164px)"));
    assert.ok(theme.includes('[data-biomes-mobile-hotbar="true"]'));
    assert.ok(theme.includes("min-width: 48px"));
    assert.ok(theme.includes(".biomes-ui-current-objective-hud--phone"));
    assert.ok(ui.includes("data-biomes-mobile-ui-overlay"));
    assert.ok(ui.includes("const phoneLayout = clientConfig.mobileDevice"));
    assert.ok(ui.includes("mobile={phoneLayout}"));
    assert.ok(ui.includes("mobile={clientConfig.showVirtualJoystick}"));
    assert.ok(nav.includes("data-biomes-mobile-nav"));
    assert.ok(nav.includes('flexWrap: mobile ? "nowrap" : "wrap"'));
  });
});
