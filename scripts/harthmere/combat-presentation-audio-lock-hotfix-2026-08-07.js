(() => {
  const VERSION =
    "harthmere-combat-presentation-audio-lock-hotfix-2026-08-07-v1";
  const ACTIVE_SCOPE_KEY = "biomes.localDev.harthmere.activeUserScope";
  const COMBAT_STATE_KEY = "biomes.localDev.harthmere.combatState";
  const REDUCED_ATTRIBUTE = "data-harthmere-combat-presentation";
  const MINIMAP_ATTRIBUTE = "data-harthmere-combat-minimap-root";
  const STYLE_ID = "harthmere-combat-presentation-hotfix-style";
  const DESKTOP_MARKER_DISTANCE = 128;
  const DESKTOP_MARKER_LIMIT = 72;
  const DESKTOP_COMBAT_OVERLAY_INTERVAL_MS = 50;
  const MOBILE_OVERLAY_INTERVAL_MS = 80;
  const MOBILE_EMERGENCY_OVERLAY_INTERVAL_MS = 200;
  const PATCHED = Symbol.for(`${VERSION}:patched`);

  if (globalThis.__harthmereCombatPresentationHotfix?.version === VERSION) {
    return;
  }

  const restored = [];
  let presentationSuspended = false;
  let pendingBossStomp;

  const parse = (value) => {
    try {
      return value ? JSON.parse(value) : undefined;
    } catch {
      return undefined;
    }
  };

  const activeUserScope = () =>
    sessionStorage.getItem(ACTIVE_SCOPE_KEY) ||
    localStorage.getItem(ACTIVE_SCOPE_KEY) ||
    "anonymous";

  const combatState = () =>
    parse(localStorage.getItem(`${COMBAT_STATE_KEY}.user.${activeUserScope()}`))
      ?.player?.combatState;

  const biomesUiOpen = () =>
    Boolean(document.querySelector(".biomes-ui-overlay"));

  const shouldSuspendPresentation = () =>
    combatState() === "in_combat" && !biomesUiOpen();

  const tagMinimapRoot = () => {
    const minimap = document.querySelector(".mini-map");
    const root = minimap?.parentElement;
    if (root) root.setAttribute(MINIMAP_ATTRIBUTE, "true");
  };

  const refreshPresentation = () => {
    tagMinimapRoot();
    presentationSuspended = shouldSuspendPresentation();
    if (presentationSuspended) {
      document.documentElement.setAttribute(REDUCED_ATTRIBUTE, "suspended");
    } else {
      document.documentElement.removeAttribute(REDUCED_ATTRIBUTE);
    }
  };

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
html[${REDUCED_ATTRIBUTE}="suspended"] [${MINIMAP_ATTRIBUTE}="true"],
html[${REDUCED_ATTRIBUTE}="suspended"] .navigation-overlay-wrap,
html[${REDUCED_ATTRIBUTE}="suspended"] .biomes-ui-current-objective-hud,
html[${REDUCED_ATTRIBUTE}="suspended"] [data-snapshot-grove-tutor-prompt="visible"],
html[${REDUCED_ATTRIBUTE}="suspended"] button[aria-label^="Invite Received"],
html[${REDUCED_ATTRIBUTE}="suspended"] [role="dialog"][aria-label="Quest invites"] {
  display: none !important;
}
`;
  document.head.appendChild(style);

  const resumeAudioFromTrustedGesture = () => {
    const audioManager = globalThis.clientContext?.audioManager;
    if (audioManager && !audioManager.isRunning?.()) {
      void Promise.resolve(audioManager.resumeAudio?.()).then(() => {
        if (pendingBossStomp && audioManager.isRunning?.()) {
          const request = pendingBossStomp;
          pendingBossStomp = undefined;
          request.play();
        }
      });
    }
  };
  const audioListenerOptions = { capture: true, passive: true };
  document.addEventListener(
    "pointerdown",
    resumeAudioFromTrustedGesture,
    audioListenerOptions
  );
  document.addEventListener(
    "touchstart",
    resumeAudioFromTrustedGesture,
    audioListenerOptions
  );
  document.addEventListener(
    "keydown",
    resumeAudioFromTrustedGesture,
    audioListenerOptions
  );

  const markerIsRequired = (renderer, markerId) =>
    markerId === renderer.activeMarkerId ||
    markerId === renderer.chapter1ObjectiveMarkerId ||
    renderer.visibleSnapshotGroveMarkerIds?.has?.(markerId);

  const syncMarkerBudget = (renderer) => {
    const markerMeshes = renderer.markerMeshes;
    const playerPosition = globalThis.clientContext?.resources?.get?.(
      "/scene/local_player"
    )?.player?.position;
    if (!(markerMeshes instanceof Map) || !playerPosition) return;

    const permanent = [];
    for (const [markerId, marker] of markerMeshes) {
      if (
        marker?.userData?.harthmereQuestObjectMarkerAlwaysVisible === true ||
        marker?.userData?.harthmereCombatHotfixPermanent === true
      ) {
        marker.userData.harthmereCombatHotfixPermanent = true;
        permanent.push({
          markerId,
          marker,
          distance: Math.hypot(
            Number(marker.position?.x ?? 0) - Number(playerPosition[0]),
            Number(marker.position?.z ?? 0) - Number(playerPosition[2])
          ),
        });
      }
    }
    const nearbyIds = new Set(
      permanent
        .filter((entry) => entry.distance <= DESKTOP_MARKER_DISTANCE)
        .sort((left, right) => left.distance - right.distance)
        .slice(0, DESKTOP_MARKER_LIMIT)
        .map((entry) => entry.markerId)
    );
    for (const { markerId, marker } of permanent) {
      const nearby = nearbyIds.has(markerId);
      marker.userData.harthmereQuestObjectMarkerAlwaysVisible = nearby;
      if (!nearby && !markerIsRequired(renderer, markerId)) {
        marker.visible = false;
      }
    }
  };

  const patchQuestMarkerRenderer = () => {
    const renderers = globalThis.clientContext?.rendererController?.renderers;
    const renderer = Array.isArray(renderers)
      ? renderers.find((candidate) =>
          String(candidate?.name ?? "").includes(
            "harthmere-quest-object-marker"
          )
        )
      : undefined;
    if (!renderer || renderer[PATCHED] || typeof renderer.draw !== "function") {
      return Boolean(renderer?.[PATCHED]);
    }
    const originalDraw = renderer.draw;
    let lastMarkerSyncAt = -Infinity;
    renderer.draw = function combatPresentationMarkerHotfix(scenes, dt) {
      if (shouldSuspendPresentation()) {
        this.root?.removeFromParent?.();
        return;
      }
      const now = performance.now();
      if (now - lastMarkerSyncAt >= 500) {
        lastMarkerSyncAt = now;
        syncMarkerBudget(this);
      }
      return originalDraw.call(this, scenes, dt);
    };
    renderer[PATCHED] = true;
    restored.push(() => {
      renderer.draw = originalDraw;
      delete renderer[PATCHED];
      for (const marker of renderer.markerMeshes?.values?.() ?? []) {
        if (marker?.userData?.harthmereCombatHotfixPermanent === true) {
          marker.userData.harthmereQuestObjectMarkerAlwaysVisible = true;
          delete marker.userData.harthmereCombatHotfixPermanent;
        }
      }
    });
    return true;
  };

  const patchBossStompAudio = () => {
    const audioManager = globalThis.clientContext?.audioManager;
    if (
      !audioManager ||
      audioManager[PATCHED] ||
      typeof audioManager.playPathAt !== "function"
    ) {
      return Boolean(audioManager?.[PATCHED]);
    }
    const originalPlayPathAt = audioManager.playPathAt;
    audioManager.playPathAt = function bossStompQueueHotfix(
      assetPath,
      position,
      options
    ) {
      if (
        String(assetPath).includes("/giant_boss_stomp.") &&
        !this.isRunning?.()
      ) {
        pendingBossStomp = {
          play: () =>
            originalPlayPathAt.call(this, assetPath, position, options),
        };
        return;
      }
      return originalPlayPathAt.call(this, assetPath, position, options);
    };
    audioManager[PATCHED] = true;
    restored.push(() => {
      audioManager.playPathAt = originalPlayPathAt;
      delete audioManager[PATCHED];
      pendingBossStomp = undefined;
    });
    return true;
  };

  const patchOverlayScript = () => {
    const scripts = globalThis.clientContext?.rendererScripts?.scripts;
    const overlay = Array.isArray(scripts)
      ? scripts.find((script) => script?.name === "overlay")
      : undefined;
    if (!overlay || overlay[PATCHED] || typeof overlay.tick !== "function") {
      return Boolean(overlay?.[PATCHED]);
    }
    const originalTick = overlay.tick;
    let lastRefreshAt;
    let lastTickAt;
    overlay.tick = function combatPresentationOverlayHotfix(dt) {
      const now = performance.now();
      const frameGap = lastTickAt === undefined ? undefined : now - lastTickAt;
      lastTickAt = now;
      const mobile =
        globalThis.clientContext?.clientConfig?.mobileDevice === true;
      const interval = mobile
        ? typeof frameGap === "number" && frameGap >= 100
          ? MOBILE_EMERGENCY_OVERLAY_INTERVAL_MS
          : MOBILE_OVERLAY_INTERVAL_MS
        : shouldSuspendPresentation()
          ? DESKTOP_COMBAT_OVERLAY_INTERVAL_MS
          : 0;
      if (
        interval > 0 &&
        lastRefreshAt !== undefined &&
        now >= lastRefreshAt &&
        now - lastRefreshAt < interval
      ) {
        return;
      }
      lastRefreshAt = now;
      return originalTick.call(this, dt);
    };
    overlay[PATCHED] = true;
    restored.push(() => {
      overlay.tick = originalTick;
      delete overlay[PATCHED];
    });
    return true;
  };

  const patchCameraScript = () => {
    const scripts = globalThis.clientContext?.rendererScripts?.scripts;
    const camera = Array.isArray(scripts)
      ? scripts.find((script) => script?.name === "camera")
      : undefined;
    if (
      !camera ||
      camera[PATCHED] ||
      typeof camera.tickCameraOrientation !== "function"
    ) {
      return Boolean(camera?.[PATCHED]);
    }
    const originalTickCameraOrientation = camera.tickCameraOrientation;
    camera.tickCameraOrientation = function combatLockCameraHotfix(...args) {
      if (globalThis.__harthmereCombatLockOnDebug?.active === true) {
        return;
      }
      return originalTickCameraOrientation.apply(this, args);
    };
    camera[PATCHED] = true;
    restored.push(() => {
      camera.tickCameraOrientation = originalTickCameraOrientation;
      delete camera[PATCHED];
    });
    return true;
  };

  const installRuntimePatches = () => {
    patchBossStompAudio();
    patchQuestMarkerRenderer();
    patchOverlayScript();
    patchCameraScript();
  };

  const refreshEvents = [
    "storage",
    "biomes:harthmere-combat-changed",
    "biomes:harthmere-multiplayer-combat-changed",
  ];
  for (const eventName of refreshEvents) {
    window.addEventListener(eventName, refreshPresentation);
  }

  const timer = window.setInterval(() => {
    refreshPresentation();
    installRuntimePatches();
  }, 250);
  refreshPresentation();
  installRuntimePatches();

  globalThis.__harthmereCombatPresentationHotfix = {
    version: VERSION,
    appliedAt: Date.now(),
    get suspended() {
      return presentationSuspended;
    },
    refresh: refreshPresentation,
  };

  globalThis.__biomesGlitchMutableHotfix?.registerCleanup?.(() => {
    window.clearInterval(timer);
    for (const eventName of refreshEvents) {
      window.removeEventListener(eventName, refreshPresentation);
    }
    document.removeEventListener(
      "pointerdown",
      resumeAudioFromTrustedGesture,
      audioListenerOptions
    );
    document.removeEventListener(
      "touchstart",
      resumeAudioFromTrustedGesture,
      audioListenerOptions
    );
    document.removeEventListener(
      "keydown",
      resumeAudioFromTrustedGesture,
      audioListenerOptions
    );
    for (const restore of restored.splice(0).reverse()) restore();
    document.documentElement.removeAttribute(REDUCED_ATTRIBUTE);
    document
      .querySelectorAll(`[${MINIMAP_ATTRIBUTE}]`)
      .forEach((element) => element.removeAttribute(MINIMAP_ATTRIBUTE));
    document.getElementById(STYLE_ID)?.remove();
    delete globalThis.__harthmereCombatPresentationHotfix;
  });
})();
