#!/usr/bin/env node

const assert = require("assert");

const url =
  process.argv[2] ||
  process.env.HARTHMERE_MOBILE_URL ||
  process.env.BIOMES_UI_BROWSER_URL;
const timeoutMs = Number(process.env.HARTHMERE_MOBILE_TIMEOUT_MS || 120000);
const viewportWidth = Number(process.env.HARTHMERE_MOBILE_WIDTH || 390);
const viewportHeight = Number(process.env.HARTHMERE_MOBILE_HEIGHT || 844);
const orientation = viewportWidth > viewportHeight ? "landscape" : "portrait";
const diagnosticBypassLoadingOverlay =
  process.env.HARTHMERE_MOBILE_DIAGNOSTIC_BYPASS_LOADING_OVERLAY === "1";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function navigationUrlForMobileSmoke(targetUrl) {
  const target = new URL(targetUrl);
  const useVisualAuth =
    process.env.HARTHMERE_MOBILE_VISUAL_AUTH !== "0" &&
    ["127.0.0.1", "localhost"].includes(target.hostname);
  if (!useVisualAuth) {
    return target.toString();
  }
  const bridge = new URL("/dev/harthmere-visual-auth", target.origin);
  bridge.searchParams.set(
    "username",
    process.env.HARTHMERE_MOBILE_TEST_USER ||
      `MobileIOSSmoke${orientation === "landscape" ? "Landscape" : "Portrait"}`
  );
  bridge.searchParams.set("next", `${target.pathname}${target.search}`);
  return bridge.toString();
}

function seriousConsoleError(line) {
  return (
    /webglcontextlost|unexpectedly lost main webgl context|exception while rendering|unhandled runtime error/i.test(
      line
    ) ||
    (/^error:/i.test(line) &&
      !/favicon|source map|status of 404|failed to load resource/i.test(line))
  );
}

function rectanglesOverlap(a, b, inset = 2) {
  if (!a || !b) return false;
  return (
    a.left < b.right - inset &&
    a.right > b.left + inset &&
    a.top < b.bottom - inset &&
    a.bottom > b.top + inset
  );
}

async function sampleAnimationFrames(page, durationMs) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const started = performance.now();
        let frames = 0;
        let last = started;
        let worstGapMs = 0;
        const tick = (now) => {
          frames += 1;
          worstGapMs = Math.max(worstGapMs, now - last);
          last = now;
          if (now - started >= duration) {
            resolve({
              frames,
              elapsedMs: now - started,
              fps: (frames * 1000) / (now - started),
              worstGapMs,
            });
          } else {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      }),
    durationMs
  );
}

async function gameplayDiagnostics(page) {
  return page.evaluate(() => {
    const context = globalThis.clientContext;
    const position = context?.resources.get("/scene/local_player")?.player
      ?.position;
    let supportingShard;
    if (position) {
      const [x, y, z] = position.map((value, index) =>
        Math.floor((value - (index === 1 ? 1 : 0)) / 32)
      );
      supportingShard = String.fromCharCode(
        (5 & 0x1f) |
          (x < 0 ? 0x80 : 0) |
          (y < 0 ? 0x40 : 0) |
          (z < 0 ? 0x20 : 0),
        Math.abs(x) & 0xff,
        Math.abs(y) & 0xff,
        Math.abs(z) & 0xff
      );
    }
    return {
      href: location.href,
      title: document.title,
      bodyText: document.body.innerText.slice(0, 1000),
      hasClientContext: Boolean(context),
      loadingWrappers: document.querySelectorAll(".loading-wrapper").length,
      loadingText: Array.from(document.querySelectorAll(".loading-wrapper"))
        .map((element) => element.textContent?.trim())
        .filter(Boolean),
      wakeupScreens: document.querySelectorAll(
        ".wake-up-container, .harthmere-wakeup-character-builder, .harthmere-wakeup-name-entry, [data-ui-id='wake_up.screen'], [data-ui-id='character_builder.screen'], [data-ui-id='enter_world.screen']"
      ).length,
      showVirtualJoystick: context?.clientConfig?.showVirtualJoystick,
      lowMemory: context?.clientConfig?.lowMemory,
      renderedFrames: context?.rendererController?.renderedFrames,
      localPlayerPosition: position,
      supportingShard: supportingShard
        ? [
            Math.floor(position[0] / 32),
            Math.floor((position[1] - 1) / 32),
            Math.floor(position[2] / 32),
          ]
        : undefined,
      supportingTerrain: supportingShard
        ? Boolean(context.resources.get("/ecs/terrain", supportingShard))
        : undefined,
      supportingBoxes: supportingShard
        ? Boolean(context.resources.get("/physics/boxes", supportingShard))
        : undefined,
      supportingMeshCached: supportingShard
        ? Boolean(
            context.resources.cached("/terrain/combined_mesh", supportingShard)
          )
        : undefined,
      graphics: context?.resources.get("/settings/graphics/dynamic"),
    };
  });
}

async function waitForGameplayStage(page, label, predicate, timeout) {
  try {
    await page.waitForFunction(predicate, { timeout });
  } catch (error) {
    throw new Error(
      `${label} timed out: ${JSON.stringify(
        await gameplayDiagnostics(page)
      )}\n${error.stack || error.message || String(error)}`
    );
  }
}

async function exerciseMovementJoystick(page) {
  const joystick = await page.$('[aria-label="Movement joystick"]');
  assert(joystick, "mobile movement joystick is mounted");
  const box = await joystick.boundingBox();
  assert(
    box && box.width > 0 && box.height > 0,
    "movement joystick is visible"
  );
  const stick = await joystick.$('[data-testid="joystick-base"] button');
  assert(stick, "movement joystick exposes its touch stick");
  const stickBox = await stick.boundingBox();
  assert(
    stickBox && stickBox.width > 0 && stickBox.height > 0,
    "movement joystick touch stick is visible"
  );

  await page.evaluate(() => {
    globalThis.__mobileJoystickPointerEvents = [];
    globalThis.__mobileJoystickTouchEvents = [];
    const stick = document.querySelector(
      '[aria-label="Movement joystick"] [data-testid="joystick-base"] button'
    );
    const controls = document.querySelector(
      '[data-biomes-mobile-browser-back-guard="true"]'
    );
    const record = (event) => {
      globalThis.__mobileJoystickPointerEvents.push({
        type: event.type,
        pointerType: event.pointerType,
        isPrimary: event.isPrimary,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };
    stick?.addEventListener("pointerdown", record);
    window.addEventListener("pointermove", record);
    window.addEventListener("pointerup", record);
    const recordTouch = (event) => {
      globalThis.__mobileJoystickTouchEvents.push({
        type: event.type,
        defaultPrevented: event.defaultPrevented,
      });
    };
    controls?.addEventListener("touchstart", recordTouch);
    controls?.addEventListener("touchmove", recordTouch);
  });

  const client = await page.target().createCDPSession();
  const center = {
    x: stickBox.x + stickBox.width / 2,
    y: stickBox.y + stickBox.height / 2,
  };
  const forward = {
    x: center.x,
    y: box.y + 1,
  };
  const startHit = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return {
      tagName: element?.tagName,
      className: String(element?.className ?? ""),
      testId: element?.getAttribute?.("data-testid"),
      ariaLabel: element?.getAttribute?.("aria-label"),
    };
  }, center);
  const touchPoint = (point) => ({
    x: point.x,
    y: point.y,
    radiusX: 6,
    radiusY: 6,
    force: 1,
    id: 1,
  });

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint(center)],
  });
  await sleep(150);
  for (let step = 1; step <= 4; step += 1) {
    const progress = step / 4;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        touchPoint({
          x: center.x + (forward.x - center.x) * progress,
          y: center.y + (forward.y - center.y) * progress,
        }),
      ],
    });
    await sleep(75);
  }
  await sleep(400);

  const activeInput = await page.evaluate(() => ({
    forward: globalThis.clientContext.input.motion("forward"),
    lateral: globalThis.clientContext.input.motion("lateral"),
    run: globalThis.clientContext.input.syntheticMotion(
      "run",
      "mobile-joystick"
    ),
    pointerEvents: globalThis.__mobileJoystickPointerEvents,
    touchEvents: globalThis.__mobileJoystickTouchEvents,
  }));
  const active = { ...activeInput, startHit };

  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await sleep(300);

  const released = await page.evaluate(() => ({
    forward: globalThis.clientContext.input.motion("forward"),
    lateral: globalThis.clientContext.input.motion("lateral"),
    run: globalThis.clientContext.input.syntheticMotion(
      "run",
      "mobile-joystick"
    ),
  }));

  assert(
    Math.abs(active.forward) > 0.01 || Math.abs(active.lateral) > 0.01,
    `joystick produces movement input; got ${JSON.stringify(active)}`
  );
  assert.equal(
    active.run,
    1,
    `full joystick deflection runs instead of walking; got ${JSON.stringify(
      active
    )}`
  );
  assert(
    active.touchEvents.some(
      (event) => event.type === "touchstart" && event.defaultPrevented
    ) &&
      active.touchEvents.some(
        (event) => event.type === "touchmove" && event.defaultPrevented
      ),
    `joystick owns touchstart and touchmove before browser history navigation; got ${JSON.stringify(
      active.touchEvents
    )}`
  );
  assert.equal(released.run, 0, "joystick run input releases after touchend");
  const guardedUrl = await page.url();
  await page.evaluate(() => window.history.back());
  await sleep(350);
  const historyGuard = await page.evaluate(() => ({
    href: location.href,
    state: history.state,
  }));
  assert.equal(
    historyGuard.href,
    guardedUrl,
    `mobile gameplay consumes Safari Back instead of leaving the game; got ${JSON.stringify(
      historyGuard
    )}`
  );
  assert.equal(
    historyGuard.state?.__biomesMobileMovementHistoryGuard,
    true,
    "mobile movement history guard is restored after Back"
  );
  return { active, released, historyGuard };
}

async function exerciseMovementButtons(page) {
  const selectors = {
    crouch: '[data-biomes-mobile-crouch="true"]',
    jump: '[data-biomes-mobile-jump="true"]',
  };
  const boxes = {};
  for (const [name, selector] of Object.entries(selectors)) {
    const button = await page.$(selector);
    assert(button, `${name} button is mounted`);
    const box = await button.boundingBox();
    assert(
      box && box.width >= 44 && box.height >= 44,
      `${name} button keeps a touch-safe target; got ${JSON.stringify(box)}`
    );
    boxes[name] = box;
  }

  const joystick = await page.$('[aria-label="Movement joystick"]');
  const joystickBox = await joystick.boundingBox();
  assert(
    boxes.crouch.y >= joystickBox.y + joystickBox.height - 1 &&
      boxes.jump.y >= joystickBox.y + joystickBox.height - 1,
    `crouch and jump sit below the joystick; got ${JSON.stringify({
      joystickBox,
      boxes,
    })}`
  );

  const client = await page.target().createCDPSession();
  const touchPoint = (box, id) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    radiusX: 6,
    radiusY: 6,
    force: 1,
    id,
  });

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint(boxes.crouch, 2)],
  });
  await sleep(100);
  const crouchHeld = await page.evaluate(() =>
    globalThis.clientContext.input.syntheticMotion(
      "crouch",
      "mobile-crouch-button"
    )
  );
  assert(crouchHeld > 0, "crouch touch reaches synthetic movement input");
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await sleep(100);

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint(boxes.jump, 3)],
  });
  await sleep(100);
  const jumpHeld = await page.evaluate(() =>
    globalThis.clientContext.input.action("jump")
  );
  assert.equal(jumpHeld, true, "jump touch reaches the shared jump action");
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await sleep(100);
  const released = await page.evaluate(() => ({
    crouch: globalThis.clientContext.input.syntheticMotion(
      "crouch",
      "mobile-crouch-button"
    ),
    jump: globalThis.clientContext.input.action("jump"),
  }));
  assert.equal(released.crouch, 0, "crouch releases after touchend");
  assert.equal(released.jump, false, "jump releases after touchend");

  return { boxes, crouchHeld, jumpHeld, released };
}

async function exerciseMobileHud(page) {
  try {
    await page.waitForSelector('[data-biomes-mobile-menu="true"]', {
      timeout: 15000,
    });
    await page.waitForSelector('[data-biomes-mobile-hotbar="true"]', {
      timeout: 15000,
    });
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      href: location.href,
      lowMemory: globalThis.clientContext?.clientConfig?.lowMemory,
      showVirtualJoystick:
        globalThis.clientContext?.clientConfig?.showVirtualJoystick,
      gameModal: globalThis.clientContext?.reactResources?.get?.("/game_modal"),
      loadingWrappers: document.querySelectorAll(".loading-wrapper").length,
      wakeupScreens: document.querySelectorAll(
        ".wake-up-container, .harthmere-wakeup-character-builder, .harthmere-wakeup-name-entry, [data-ui-id='wake_up.screen'], [data-ui-id='character_builder.screen'], [data-ui-id='enter_world.screen']"
      ).length,
      mobileMenu: document.querySelectorAll('[data-biomes-mobile-menu="true"]')
        .length,
      mobileHotbar: document.querySelectorAll(
        '[data-biomes-mobile-hotbar="true"]'
      ).length,
      vitals: document.querySelectorAll(".biomes-ui-vitals-panel--mobile")
        .length,
      dialogs: Array.from(document.querySelectorAll('[role="dialog"]')).map(
        (element) => element.getAttribute("aria-label")
      ),
      bodyText: document.body.innerText.slice(0, 800),
    }));
    throw new Error(
      `mobile gameplay HUD did not become ready: ${JSON.stringify(
        diagnostics
      )}\n${error.stack || error.message || String(error)}`
    );
  }

  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return undefined;
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const visible = (element) => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        bounds.width > 0 &&
        bounds.height > 0
      );
    };
    const vitals = document.querySelector(".biomes-ui-vitals-panel--mobile");
    return {
      viewport: { width: innerWidth, height: innerHeight },
      rootFontSize: Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize
      ),
      minimap: rect(".mini-map"),
      menu: rect('[data-biomes-mobile-menu="true"]'),
      hotbar: rect(
        '[data-biomes-mobile-hotbar="true"] [aria-label="Action hotbar"]'
      ),
      movementControls: rect('[data-biomes-mobile-browser-back-guard="true"]'),
      joystick: rect('[aria-label="Movement joystick"]'),
      crouch: rect('[data-biomes-mobile-crouch="true"]'),
      jump: rect('[data-biomes-mobile-jump="true"]'),
      objective: rect(".biomes-ui-current-objective-hud"),
      vitals: rect(".biomes-ui-vitals-panel--mobile"),
      visibleVitalIcons: vitals
        ? Array.from(
            vitals.querySelectorAll(".biomes-ui-vitals-chip__icon")
          ).filter(visible).length
        : 0,
      hiddenVitalLabels: vitals
        ? Array.from(
            vitals.querySelectorAll(".biomes-ui-vitals-chip__label-text")
          ).filter((element) => getComputedStyle(element).display === "none")
            .length
        : 0,
      visibleMenuLabels: Array.from(
        document.querySelectorAll(
          ".biomes-ui-mobile-menu--phone .biomes-ui-mobile-menu__label"
        )
      ).filter(visible).length,
      visibleMovementLabels: Array.from(
        document.querySelectorAll(
          ".joysticks--mobile .mobile-movement-button__label"
        )
      ).filter(visible).length,
      browserBackGuard: document.querySelectorAll(
        '[data-biomes-mobile-browser-back-guard="true"]'
      ).length,
      browserHistoryGuard:
        history.state?.__biomesMobileMovementHistoryGuard === true,
    };
  });

  assert(layout.minimap, "mini map is visible on mobile");
  assert(layout.menu, "mobile Menu and Recipes controls are visible");
  assert(layout.hotbar, "mobile hotbar is visible");
  assert(layout.movementControls, "mobile movement control rail is visible");
  assert(layout.joystick, "movement joystick is visible for layout checks");
  assert(layout.crouch, "mobile crouch button is visible");
  assert(layout.jump, "mobile jump button is visible");
  assert(
    layout.menu.top >= layout.minimap.bottom + 2,
    `mobile menu is below the mini map; got ${JSON.stringify(layout)}`
  );
  assert(
    layout.menu.width >= 90,
    `mobile Menu and Recipes controls keep a usable width; got ${JSON.stringify(
      layout
    )}`
  );
  assert.equal(
    layout.visibleMenuLabels,
    0,
    "phone Menu, Recipes, and Invite controls are icon-only"
  );
  assert.equal(
    layout.visibleMovementLabels,
    0,
    "phone Crouch and Jump controls are icon-only"
  );
  assert.equal(
    layout.browserBackGuard,
    1,
    "left-thumb movement region owns touch gestures before Safari navigation"
  );
  assert.equal(
    layout.browserHistoryGuard,
    true,
    "phone gameplay installs a same-document Safari Back guard"
  );
  assert(
    layout.movementControls.left >= 22,
    `left-thumb movement controls stay outside Safari's edge-swipe zone; got ${JSON.stringify(
      layout
    )}`
  );
  assert(
    !rectanglesOverlap(layout.menu, layout.objective),
    `mobile menu does not overlap the current objective; got ${JSON.stringify(
      layout
    )}`
  );
  assert(
    !rectanglesOverlap(layout.hotbar, layout.joystick),
    `hotbar does not overlap the movement joystick; got ${JSON.stringify(
      layout
    )}`
  );
  assert(
    !rectanglesOverlap(layout.hotbar, layout.crouch) &&
      !rectanglesOverlap(layout.hotbar, layout.jump),
    `hotbar does not overlap crouch or jump; got ${JSON.stringify(layout)}`
  );
  assert(
    !rectanglesOverlap(layout.objective, layout.crouch) &&
      !rectanglesOverlap(layout.objective, layout.jump),
    `current objective does not overlap crouch or jump; got ${JSON.stringify(
      layout
    )}`
  );
  assert(
    !rectanglesOverlap(layout.hotbar, layout.objective),
    `hotbar does not overlap the current objective; got ${JSON.stringify(
      layout
    )}`
  );
  assert(
    layout.hotbar.bottom <= layout.viewport.height + 1,
    "mobile hotbar remains inside the viewport"
  );
  assert(
    layout.viewport.height - layout.hotbar.bottom >= 26,
    `mobile hotbar is lifted by a real touch-safe offset; got ${JSON.stringify(
      layout
    )}`
  );
  assert(
    !layout.vitals ||
      Math.abs(
        layout.vitals.width - Math.min(layout.viewport.width * 0.46, 190)
      ) <= 2,
    `mobile vitals match the authored viewport-capped width; got ${JSON.stringify(
      layout
    )}`
  );
  assert(
    !layout.vitals || layout.vitals.height <= 150,
    `phone vitals remain compact enough to preserve world visibility; got ${JSON.stringify(
      layout
    )}`
  );
  assert(
    !layout.vitals || layout.visibleVitalIcons >= 5,
    `mobile vitals use standing, gold, and level icons; got ${layout.visibleVitalIcons}`
  );
  assert(
    !layout.vitals || layout.hiddenVitalLabels >= 5,
    `mobile vitals hide the replaced text labels; got ${layout.hiddenVitalLabels}`
  );

  const hotbarButtons = await page.$$(
    '[data-biomes-mobile-hotbar="true"] [aria-label="Action hotbar"] .biomes-ui-slot'
  );
  assert(hotbarButtons.length > 0, "mobile hotbar exposes tappable slots");
  const selectedIndex = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        '[data-biomes-mobile-hotbar="true"] [aria-label="Action hotbar"] .biomes-ui-slot'
      )
    ).findIndex((button) => button.getAttribute("aria-pressed") === "true")
  );
  const targetIndex =
    hotbarButtons.length > 1
      ? (Math.max(0, selectedIndex) + 1) % hotbarButtons.length
      : 0;
  await page.evaluate((index) => {
    document
      .querySelectorAll(
        '[data-biomes-mobile-hotbar="true"] [aria-label="Action hotbar"] .biomes-ui-slot'
      )
      [index]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, targetIndex);
  const hotbarTargetBox = await hotbarButtons[targetIndex].boundingBox();
  assert(
    hotbarTargetBox && hotbarTargetBox.width > 0 && hotbarTargetBox.height > 0,
    `target hotbar slot is visible after horizontal scrolling; got ${JSON.stringify(
      hotbarTargetBox
    )}`
  );
  console.log(
    `MOBILE_HUD_PHASE hotbar_tap orientation=${orientation} target=${targetIndex} box=${JSON.stringify(
      hotbarTargetBox
    )}`
  );
  await hotbarButtons[targetIndex].tap();
  await page.waitForFunction(
    (index) => {
      const buttons = document.querySelectorAll(
        '[data-biomes-mobile-hotbar="true"] [aria-label="Action hotbar"] .biomes-ui-slot'
      );
      return buttons[index]?.getAttribute("aria-pressed") === "true";
    },
    { timeout: 10000 },
    targetIndex
  );

  console.log(`MOBILE_HUD_PHASE menu_tap orientation=${orientation}`);
  await page.tap('[data-biomes-mobile-action="menu"]');
  await page.waitForSelector('[role="dialog"][aria-label$=" panel"]', {
    timeout: 10000,
  });
  const biomesUILayout = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return undefined;
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      overlay: rect('[data-biomes-mobile-ui-overlay="true"]'),
      nav: rect('[data-biomes-mobile-nav="true"]'),
      panel: rect(".biomes-ui-overlay__panel--mobile"),
      close: rect('[aria-label="Close Biomes UI"]'),
    };
  });
  assert(biomesUILayout.overlay, "mobile BiomesUI overlay is visible");
  assert(biomesUILayout.nav, "mobile BiomesUI navigation is visible");
  assert(biomesUILayout.panel, "mobile BiomesUI panel is visible");
  assert(biomesUILayout.close, "mobile BiomesUI close control is visible");
  assert(
    biomesUILayout.overlay.width <= biomesUILayout.viewport.width + 1 &&
      biomesUILayout.overlay.height <= biomesUILayout.viewport.height + 1,
    `BiomesUI stays inside the viewport; got ${JSON.stringify(biomesUILayout)}`
  );
  assert(
    biomesUILayout.close.width >= 44 && biomesUILayout.close.height >= 44,
    `BiomesUI close control is touch-safe; got ${JSON.stringify(
      biomesUILayout
    )}`
  );
  assert(
    biomesUILayout.nav.height <= 64,
    `BiomesUI tabs stay in one scrollable row; got ${JSON.stringify(
      biomesUILayout
    )}`
  );
  await page.tap('[aria-label="Close Biomes UI"]');
  await page.waitForSelector('[role="dialog"][aria-label$=" panel"]', {
    hidden: true,
    timeout: 10000,
  });

  console.log(`MOBILE_HUD_PHASE recipes_tap orientation=${orientation}`);
  await page.tap('[data-biomes-mobile-action="recipes"]');
  await page.waitForFunction(
    () =>
      globalThis.clientContext.reactResources.get("/game_modal").kind ===
      "crafting",
    { timeout: 10000 }
  );
  await page.evaluate(() => {
    const resources = globalThis.clientContext.reactResources;
    const modal = resources.get("/game_modal");
    modal.onClose?.();
    if (resources.get("/game_modal").kind === "crafting") {
      resources.set("/game_modal", { kind: "empty" });
    }
  });

  return {
    layout,
    biomesUILayout,
    selectedIndexBefore: selectedIndex,
    selectedIndexAfter: targetIndex,
    menuOpened: true,
    recipesOpened: true,
  };
}

async function main() {
  assert(
    url,
    "Pass a game URL or set HARTHMERE_MOBILE_URL/BIOMES_UI_BROWSER_URL."
  );

  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({
    headless: process.env.HARTHMERE_E2E_HEADLESS === "0" ? false : "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const runtimeErrors = [];
  const consoleLines = [];

  page.on("pageerror", (error) => {
    runtimeErrors.push(error.stack || error.message || String(error));
  });
  page.on("console", (message) => {
    consoleLines.push(`${message.type()}: ${message.text()}`);
  });

  await page.setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) " +
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 " +
      "Mobile/15E148 Safari/604.1"
  );
  await page.setViewport({
    width: viewportWidth,
    height: viewportHeight,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("biomes_ui_enabled", "1");
    localStorage.setItem("settings.hud.showMiniMap", "true");
    localStorage.setItem("settings.hud.showHelpButtons", "true");
    localStorage.setItem("settings.hud.showHotbar", "true");
    localStorage.setItem("settings.hud.showVitals", "true");
  });

  try {
    const response = await page.goto(navigationUrlForMobileSmoke(url), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    assert(response && response.ok(), `page returned ${response?.status()}`);

    await waitForGameplayStage(
      page,
      "client context readiness",
      () => Boolean(globalThis.clientContext),
      timeoutMs
    );
    let startupOverlayDiagnostics;
    if (diagnosticBypassLoadingOverlay) {
      await waitForGameplayStage(
        page,
        "rendered world behind loading overlay",
        () =>
          globalThis.clientContext?.rendererController?.renderedFrames > 30 &&
          Boolean(
            document.querySelector('[data-biomes-mobile-controls="true"]')
          ),
        timeoutMs
      );
      startupOverlayDiagnostics = await gameplayDiagnostics(page);
      await page.evaluate(() => {
        for (const element of document.querySelectorAll(".loading-wrapper")) {
          element.style.setProperty("display", "none", "important");
        }
      });
    } else {
      await waitForGameplayStage(
        page,
        "loading overlay removal",
        () => !document.querySelector(".loading-wrapper"),
        timeoutMs
      );
    }
    await page.waitForSelector('[data-biomes-mobile-controls="true"]', {
      timeout: 15000,
    });

    const beforeFrames = await page.evaluate(
      () => globalThis.clientContext.rendererController.renderedFrames
    );
    const frameSample = await sampleAnimationFrames(page, 3000);
    const afterFrames = await page.evaluate(
      () => globalThis.clientContext.rendererController.renderedFrames
    );
    assert(afterFrames > beforeFrames, "the world render loop advances");
    assert(frameSample.frames >= 3, "requestAnimationFrame remains live");

    const hud = await exerciseMobileHud(page);
    const joystick = await exerciseMovementJoystick(page);
    const movementButtons = await exerciseMovementButtons(page);
    const state = await page.evaluate(() => {
      const context = globalThis.clientContext;
      return {
        lowMemory: context.clientConfig.lowMemory,
        showVirtualJoystick: context.clientConfig.showVirtualJoystick,
        voxelooMemoryMb: context.clientConfig.voxelooMemoryMb,
        dynamicMinDrawDistance: context.clientConfig.dynamicMinDrawDistance,
        graphics: context.resources.get("/settings/graphics/dynamic"),
        resolvedGraphics: context.resources.get("/settings/graphics/resolved"),
        rendererPixelRatio:
          context.rendererController.passRenderer?.pixelRatio(),
        renderedFrames: context.rendererController.renderedFrames,
        loadingWrappers: document.querySelectorAll(".loading-wrapper").length,
        visibleLoadingWrappers: Array.from(
          document.querySelectorAll(".loading-wrapper")
        ).filter((element) => getComputedStyle(element).display !== "none")
          .length,
        canvases: Array.from(document.querySelectorAll("canvas")).map(
          (canvas) => ({
            width: canvas.width,
            height: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
            className: String(canvas.className),
          })
        ),
      };
    });

    assert.equal(state.lowMemory, true, "mobile uses low-memory configuration");
    assert.equal(
      state.showVirtualJoystick,
      true,
      "mobile uses virtual joystick controls"
    );
    assert(
      state.voxelooMemoryMb <= 256,
      `mobile Voxeloo memory stays within the phone budget; got ${state.voxelooMemoryMb}MB`
    );
    assert(
      state.resolvedGraphics.quality === "low" ||
        state.resolvedGraphics.quality === "safeMode",
      `mobile ignores stored high graphics settings; got ${state.resolvedGraphics.quality}`
    );
    assert.equal(
      state.resolvedGraphics.postprocesses.bloom,
      false,
      "mobile disables bloom"
    );
    assert.equal(
      state.resolvedGraphics.postprocesses.waterReflection,
      false,
      "mobile disables water reflections"
    );
    if (diagnosticBypassLoadingOverlay) {
      assert.equal(
        state.visibleLoadingWrappers,
        0,
        "diagnostic loading overlay bypass exposes the playable world"
      );
      assert.equal(
        startupOverlayDiagnostics?.supportingTerrain,
        true,
        "diagnostic bypass requires local terrain"
      );
      assert.equal(
        startupOverlayDiagnostics?.supportingBoxes,
        true,
        "diagnostic bypass requires local collision boxes"
      );
    } else {
      assert.equal(state.loadingWrappers, 0, "loading overlay is gone");
    }
    assert(
      state.graphics.drawDistance <= 64,
      `mobile starts at a bounded draw distance; got ${state.graphics.drawDistance}`
    );
    assert(
      state.rendererPixelRatio <= 0.5,
      `main renderer stays at the mobile scale; got ${state.rendererPixelRatio}`
    );
    assert.equal(runtimeErrors.length, 0, runtimeErrors.join("\n---\n"));

    const seriousErrors = consoleLines.filter(seriousConsoleError);
    assert.equal(seriousErrors.length, 0, seriousErrors.join("\n---\n"));

    console.log(
      JSON.stringify(
        {
          result: diagnosticBypassLoadingOverlay
            ? "DIAGNOSTIC_GAMEPLAY_PASS"
            : "PASS",
          orientation,
          viewport: { width: viewportWidth, height: viewportHeight },
          url: page.url(),
          state,
          frameSample,
          joystick,
          movementButtons,
          hud,
          startupOverlayDiagnostics,
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
