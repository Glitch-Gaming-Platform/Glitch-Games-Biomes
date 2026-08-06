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

  it("turns continuously with the exact finger held on the mobile game canvas", () => {
    const view = read("src/client/components/BiomesView.tsx");
    const css = read("src/client/styles/biomes.css");

    assert.ok(view.includes("mobileLookTouchRef"));
    assert.ok(view.includes("event.changedTouches[0]"));
    assert.ok(view.includes("touch.identifier"));
    assert.ok(
      view.includes("touchWithIdentifier(event.touches, active.identifier)")
    );
    assert.ok(view.includes('input.moveTouchScreen("canvas", moveX, moveY)'));
    assert.ok(view.includes("finishMobileLookTouch"));
    assert.ok(
      view.includes('document.addEventListener(\n        "touchstart"')
    );
    assert.ok(view.includes('document.addEventListener(\n        "touchmove"'));
    assert.ok(view.includes("capture: true"));
    assert.ok(view.includes("passive: false"));
    assert.ok(view.includes('"[data-biomes-mobile-controls]"'));
    assert.ok(view.includes('".biomes-ui-hotbar-hud"'));
    assert.ok(view.includes("current.scrollHeight > current.clientHeight"));
    assert.ok(view.includes("current.scrollWidth > current.clientWidth"));
    assert.ok(view.includes("biomesMobileLookMoves"));
    assert.ok(view.includes("data-biomes-mobile-look-drag={"));
    assert.ok(view.includes("clientConfig.mobileDevice"));
    assert.ok(css.includes(".biomes-canvas--mobile-look"));
    assert.ok(css.includes("touch-action: none"));
    assert.ok(css.includes("overscroll-behavior: none"));
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

  it("defers mobile music until a real document touch without changing desktop unlock", () => {
    const view = read("src/client/components/BiomesView.tsx");
    assert.ok(view.includes("if (!clientConfig.mobileDevice)"));
    assert.ok(view.includes("const resumeMobileAudio = () =>"));
    assert.ok(
      view.includes(
        'document.addEventListener(\n        "touchstart",\n        resumeMobileAudio'
      )
    );
    assert.ok(
      view.includes(
        'document.removeEventListener(\n        "touchstart",\n        resumeMobileAudio'
      )
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

  it("hides mobile gameplay controls and BiomesUI during onboarding screens", () => {
    const prompt = read(
      "src/client/components/biomes_ui/BiomesUIOpenPrompt.tsx"
    );
    const joystick = read("src/client/components/JoystickInput.tsx");
    const biomesUI = read("src/client/components/biomes_ui/BiomesUIMount.tsx");

    assert.ok(
      prompt.includes("export function useBiomesUINonGameplayScreenVisible()")
    );
    assert.ok(joystick.includes("useBiomesUINonGameplayScreenVisible"));
    assert.ok(joystick.includes("MOBILE_CONTROLS_HIDE_FOR_GAME_MODAL"));
    assert.ok(joystick.includes('reactResources.use("/game_modal")'));
    assert.ok(
      joystick.includes(
        'clientConfig.mobileDevice && gameModal.kind !== "empty"'
      )
    );
    assert.ok(
      joystick.includes("clientConfig.mobileDevice && nonGameplayScreenVisible")
    );
    assert.ok(biomesUI.includes("useBiomesUINonGameplayScreenVisible"));
    assert.ok(
      biomesUI.includes("clientConfig.mobileDevice && nonGameplayScreenVisible")
    );
  });

  it("keeps the required mobile onboarding name form readable and touch-sized", () => {
    const wakeup = read("src/client/components/WakeUpScreen.tsx");
    const characterCss = read("src/client/styles/edit_character.css");

    assert.ok(wakeup.includes("clientConfig.mobileDevice"));
    assert.ok(wakeup.includes("harthmere-wakeup-name-entry"));
    assert.ok(wakeup.includes('"flex w-full flex-col gap-3"'));
    assert.ok(wakeup.includes("harthmere-wakeup-name-input"));
    assert.ok(wakeup.includes("min-h-[44px] w-full"));
    assert.ok(wakeup.includes("w-[min(92vw,24rem)]"));
    assert.ok(
      characterCss.includes(
        ".harthmere-wakeup-name-entry .harthmere-wakeup-name-input"
      )
    );
    assert.ok(characterCss.includes("font-size: 16px !important"));
  });

  it("keeps the phone character builder scrollable with reachable touch controls", () => {
    const wakeup = read("src/client/components/WakeUpScreen.tsx");
    const characterCss = read("src/client/styles/edit_character.css");

    assert.ok(wakeup.includes("harthmere-wakeup-character-builder--mobile"));
    assert.ok(wakeup.includes("harthmere-builder-options-scroll--mobile"));
    assert.ok(
      wakeup.includes('paddingTop: "max(8px, env(safe-area-inset-top))"')
    );
    assert.ok(
      characterCss.includes(
        ".harthmere-wakeup-character-builder--mobile [data-harthmere-builder-layout]"
      )
    );
    assert.ok(characterCss.includes("max-height: none !important"));
    assert.ok(characterCss.includes("min-height: 44px !important"));
  });

  it("keeps all coarse-pointer dialog actions at an iOS-safe touch size", () => {
    const hud = read("src/client/styles/hud.css");
    assert.ok(hud.includes("MOBILE_DIALOG_TOUCH_TARGETS"));
    assert.ok(hud.includes("@media (hover: none) and (pointer: coarse)"));
    assert.ok(hud.includes(".button.dialog-button.xl"));
    assert.ok(hud.includes("min-height: 44px;"));
    assert.ok(hud.includes("font-size: max(16px, var(--font-size-large));"));
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
    assert.ok(joystick.includes("preventMobileBrowserNavigationGesture"));
    assert.ok(
      joystick.includes('document.addEventListener(\n      "touchstart"')
    );
    assert.ok(
      joystick.includes('document.addEventListener(\n      "touchmove"')
    );
    assert.ok(joystick.includes("passive: false"));
    assert.ok(joystick.includes("data-biomes-mobile-browser-back-guard"));
    assert.ok(joystick.includes("MOBILE_MOVEMENT_HISTORY_GUARD_KEY"));
    assert.ok(joystick.includes('window.addEventListener("popstate"'));
    assert.ok(joystick.includes("window.history.pushState"));
    assert.ok(hud.includes("padding-left: max(24px"));
    assert.ok(hud.includes("bottom: max(40px"));
    assert.ok(hud.includes("align-items: flex-start"));
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
    const audio = read("src/client/game/context_managers/audio_manager.ts");
    const spatialMedia = read("src/client/components/SpatialMediaPlayer.tsx");
    const css3dTv = read("src/client/components/css3d/CSS3DTV.tsx");

    assert.ok(config.includes("MOBILE_VOXELOO_MEMORY_SCALE = 0.125"));
    assert.ok(config.includes("ret.forceRenderScale = 0.5"));
    assert.ok(audio.includes("backgroundMusicTracksForDevice"));
    assert.ok(audio.includes("shouldPrefetchAllAudioAssets"));
    assert.ok(audio.includes("clientConfig.mobileDevice"));
    assert.ok(spatialMedia.includes("clientConfig.mobileDevice"));
    assert.ok(css3dTv.includes("mobileStaticMedia"));
  });

  it("keeps joystick walk/run independent from the keyboard run toggle", () => {
    const player = read("src/client/game/scripts/player.ts");
    assert.ok(player.includes("motionWithoutSyntheticSource"));
    assert.ok(player.includes("mobileJoystickRunState !== 0"));
    assert.ok(player.includes("running = mobileJoystickRunState > 0"));
  });

  it("uses accessible icon-only phone Menu, Recipes, and Invite buttons", () => {
    const prompt = read(
      "src/client/components/biomes_ui/BiomesUIOpenPrompt.tsx"
    );
    const ui = read("src/client/components/biomes_ui/BiomesUI.tsx");
    const shop = read(
      "src/client/components/inventory/BiomesUIShopChrome.tsx"
    );
    const crafting = read(
      "src/client/components/inventory/crafting/GeneralCraftingStationScreen.tsx"
    );
    const invite = read(
      "src/client/components/system/PlayerInviteModal.tsx"
    );
    const textSign = read("src/client/components/TextSignConfigureModal.tsx");

    assert.ok(prompt.includes("clientConfig.showVirtualJoystick"));
    assert.ok(ui.includes("const phoneLayout = clientConfig.mobileDevice"));
    assert.ok(ui.includes("zIndex: phoneLayout ? 5 : undefined"));
    assert.ok(ui.includes("MOBILE_BIOMES_UI_CLOSE_TOUCH"));
    assert.ok(ui.includes("containMobileControlEvent(event)"));
    assert.ok(ui.includes("if (event.detail !== 0)"));
    assert.ok(shop.includes("MOBILE_BIOMES_UI_SHOP_CLOSE_TOUCH"));
    assert.ok(shop.includes("if (!mobile)"));
    assert.ok(crafting.includes("mobile={clientConfig.mobileDevice}"));
    assert.ok(invite.includes("MOBILE_PLAYER_INVITE_CLOSE_TOUCH"));
    assert.ok(invite.includes('aria-label="Close invite"'));
    assert.ok(ui.includes("mobile={phoneLayout}"));
    assert.ok(textSign.includes("MOBILE_TEXT_SIGN_CLOSE_TOUCH"));
    assert.ok(textSign.includes("clientConfig.mobileDevice"));
    assert.ok(textSign.includes('event.pointerType !== "touch"'));
    assert.ok(prompt.includes('data-biomes-mobile-menu="true"'));
    assert.ok(prompt.includes('data-biomes-mobile-action="menu"'));
    assert.ok(prompt.includes('data-biomes-mobile-action="recipes"'));
    assert.ok(prompt.includes('data-biomes-mobile-action="invite"'));
    assert.ok(prompt.includes('aria-label="Open Recipes"'));
    assert.ok(prompt.includes('aria-label="Invite friends"'));
    assert.ok(prompt.includes("biomes-ui-mobile-menu__label"));
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
    const theme = read(
      "src/client/components/biomes_ui/theme/biomesUITheme.ts"
    );
    assert.ok(
      theme.includes(
        ".biomes-ui-mobile-menu--phone .biomes-ui-mobile-menu__label"
      )
    );
    assert.ok(theme.includes("width: 44px;"));
    assert.ok(theme.includes("display: none;"));
  });

  it("makes mobile shortcut prompts tappable without leaking into canvas input", () => {
    const shortcut = read("src/client/components/system/ShortcutText.tsx");
    assert.ok(shortcut.includes("key-hint-mobile-action"));
    assert.ok(shortcut.includes("containMobileControlEvent"));
    assert.ok(shortcut.includes("invokeSelectedWorldInteractionForKey"));
    assert.ok(shortcut.includes("onPointerDown"));
    assert.ok(shortcut.includes("event.detail === 0"));
  });

  it("shows one contextual F button for the winning mobile world interaction", () => {
    const joystick = read("src/client/components/JoystickInput.tsx");
    const dispatcher = read(
      "src/client/components/challenges/worldInteractionDispatcher.ts"
    );
    const hud = read("src/client/styles/hud.css");

    assert.ok(dispatcher.includes("useHasSelectedWorldInteractionCandidate"));
    assert.ok(
      joystick.includes('useHasSelectedWorldInteractionCandidate("KeyF")')
    );
    assert.ok(joystick.includes("mobileInteractAvailable"));
    assert.ok(joystick.includes('data-biomes-mobile-interact="true"'));
    assert.ok(joystick.includes('aria-label="Interact or talk (F)"'));
    assert.ok(
      joystick.includes('invokeSelectedWorldInteractionForKey("KeyF")')
    );
    assert.ok(joystick.includes("interactPointerIdRef"));
    assert.ok(joystick.includes("setPointerCapture?.(event.pointerId)"));
    assert.ok(
      joystick.includes(
        "event.currentTarget.setPointerCapture?.(event.pointerId);\n            // An interaction candidate can disappear"
      )
    );
    assert.ok(
      joystick.includes(
        '// hold, so invoke while the selected candidate is still present.\n            invokeSelectedWorldInteractionForKey("KeyF");'
      )
    );
    assert.ok(hud.includes(".joysticks--mobile .mobile-interact-button"));
    assert.ok(hud.includes("top: 50%;"));
    assert.ok(hud.includes("left: 50%;"));
    assert.ok(hud.includes("transform: translate(-50%, -50%);"));
  });

  it("uses a compact one-row phone vitals strip without changing desktop", () => {
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
    assert.ok(vitals.includes("biomes-ui-vitals-panel--phone"));
    assert.ok(vitals.includes("biomes-ui-vitals-panel__stats"));
    assert.ok(
      theme.includes(
        ".biomes-ui-vitals-panel--mobile .biomes-ui-vitals-bar__label-text"
      )
    );
    assert.ok(theme.includes("width: min(54vw, 320px);"));
    assert.ok(theme.includes("width: min(46vw, 190px);"));
    assert.ok(
      theme.includes("grid-template-columns: repeat(5, minmax(0, 1fr));")
    );
    assert.ok(
      theme.includes(
        ".biomes-ui-vitals-panel--phone .biomes-ui-vitals-chip__track"
      )
    );
  });

  it("stacks compact phone menu actions flush with vitals and moves controls into the objective row", () => {
    const prompt = read(
      "src/client/components/biomes_ui/BiomesUIOpenPrompt.tsx"
    );
    const objective = read(
      "src/client/components/biomes_ui/CurrentQuestObjectiveHUD.tsx"
    );
    const joystick = read("src/client/components/JoystickInput.tsx");
    const theme = read(
      "src/client/components/biomes_ui/theme/biomesUITheme.ts"
    );
    const hud = read("src/client/styles/hud.css");
    assert.ok(prompt.includes("biomes-ui-mobile-menu__label"));
    assert.ok(theme.includes(".biomes-ui-mobile-menu--phone {"));
    assert.ok(theme.includes("flex-direction: column;"));
    assert.ok(theme.includes("+ min(46vw, 190px) + 2px"));
    assert.ok(theme.includes("width: 38px;"));
    assert.ok(objective.includes("mobileCollapsed"));
    assert.ok(objective.includes("data-biomes-mobile-objective-collapsed"));
    assert.ok(objective.includes("aria-expanded={!mobileCollapsed}"));
    assert.ok(
      theme.includes("top: calc(max(8px, env(safe-area-inset-top)) + 126px);")
    );
    assert.ok(hud.includes("bottom: max(40px"));
    assert.ok(hud.includes("bottom: 76px;"));
    assert.ok(joystick.includes("mobileJoystickResponsivePositionForTest"));
  });

  it("keeps the short landscape phone HUD compact and clear of the safe-area edges", () => {
    const theme = read(
      "src/client/components/biomes_ui/theme/biomesUITheme.ts"
    );
    const hud = read("src/client/styles/hud.css");

    assert.ok(theme.includes("MOBILE_PHONE_LANDSCAPE_HUD"));
    assert.ok(
      theme.includes("@media (max-height: 500px) and (orientation: landscape)")
    );
    assert.ok(
      theme.includes("left: max(8px, env(safe-area-inset-left));")
    );
    assert.ok(theme.includes("width: 186px;"));
    assert.ok(
      theme.includes(
        "left: calc(max(8px, env(safe-area-inset-left)) + 232px);"
      )
    );
    assert.ok(theme.includes("width: min(34vw, 280px);"));
    assert.ok(
      theme.includes("right: max(8px, env(safe-area-inset-right));")
    );
    assert.ok(hud.includes("MOBILE_PHONE_LANDSCAPE_CONTROLS"));
    assert.ok(
      hud.includes(
        "bottom: max(22px, calc(env(safe-area-inset-bottom) + 10px));"
      )
    );
  });

  it("prevents repeated phone client mounts from reserving WASM more than once", () => {
    const wasm = read("src/client/game/webasm.ts");
    const config = read("src/client/game/client_config.ts");
    assert.ok(wasm.includes("let mobileVoxelooLoad"));
    assert.ok(wasm.includes("if (!clientConfig.mobileDevice)"));
    assert.ok(wasm.includes("return mobileVoxelooLoad"));
    assert.ok(wasm.includes("mobileVoxelooLoad = undefined"));
    assert.ok(config.includes("MOBILE_VOXELOO_MEMORY_SCALE = 0.125"));
  });

  it("removes stale missing-entity navigation aids on every device", () => {
    const mapManager = read("src/client/game/context_managers/map_manager.ts");
    assert.ok(
      mapManager.includes(
        'log.warn("Removing navigation aid for missing entity"'
      )
    );
    assert.equal(
      mapManager.includes('log.prodError("No entity found for navigation aid"'),
      false
    );
    assert.ok(mapManager.includes("this.removeNavigationAid(id!)"));
    assert.equal(mapManager.includes("private mobileDevice"), false);
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
    assert.ok(hotbar.includes("mobileSlotsRef"));
    assert.ok(hotbar.includes("data-biomes-mobile-hotbar-slot"));
    assert.ok(hotbar.includes("slotsElement.scrollTo"));
    assert.ok(hotbar.includes("MOBILE_HOTBAR_TOUCH_SELECT"));
    assert.ok(hotbar.includes("mobileSlotTapRef"));
    assert.ok(hotbar.includes("Math.hypot("));
    assert.ok(hotbar.includes("onSelect(tap.slot)"));
    assert.ok(hotbar.includes("if (mobile && event.detail !== 0)"));
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
