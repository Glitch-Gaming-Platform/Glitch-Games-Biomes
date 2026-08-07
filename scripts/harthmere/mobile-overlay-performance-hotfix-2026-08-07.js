(() => {
  const VERSION = "harthmere-mobile-overlay-performance-hotfix-2026-08-07-v1";
  const REFRESH_INTERVAL_MS = 80;
  const EMERGENCY_REFRESH_INTERVAL_MS = 200;
  const PATCHED = Symbol.for(`${VERSION}:patched`);
  const restored = [];

  const install = () => {
    const context = globalThis.clientContext;
    if (context?.clientConfig?.mobileDevice !== true) {
      return false;
    }
    const scripts = context.rendererScripts?.scripts;
    if (!Array.isArray(scripts)) {
      return false;
    }
    const overlay = scripts.find((script) => script?.name === "overlay");
    if (!overlay || overlay[PATCHED] || typeof overlay.tick !== "function") {
      return Boolean(overlay?.[PATCHED]);
    }

    const originalTick = overlay.tick;
    let lastRefreshAtMs;
    let lastTickAtMs;
    overlay.tick = function mobileOverlayPerformanceHotfix(dt) {
      const nowMs = performance.now();
      const frameGapMs =
        lastTickAtMs === undefined ? undefined : nowMs - lastTickAtMs;
      lastTickAtMs = nowMs;
      const refreshIntervalMs =
        typeof frameGapMs === "number" && frameGapMs >= 100
          ? EMERGENCY_REFRESH_INTERVAL_MS
          : REFRESH_INTERVAL_MS;
      if (
        lastRefreshAtMs !== undefined &&
        Number.isFinite(lastRefreshAtMs) &&
        Number.isFinite(nowMs) &&
        nowMs >= lastRefreshAtMs &&
        nowMs - lastRefreshAtMs < refreshIntervalMs
      ) {
        return;
      }
      lastRefreshAtMs = nowMs;
      return originalTick.call(this, dt);
    };
    overlay[PATCHED] = true;
    restored.push(() => {
      overlay.tick = originalTick;
      delete overlay[PATCHED];
    });
    globalThis.__harthmereMobileOverlayPerformanceHotfix = {
      version: VERSION,
      refreshIntervalMs: REFRESH_INTERVAL_MS,
      emergencyRefreshIntervalMs: EMERGENCY_REFRESH_INTERVAL_MS,
      appliedAt: Date.now(),
    };
    return true;
  };

  const timer = window.setInterval(install, 250);
  install();
  globalThis.__biomesGlitchMutableHotfix?.registerCleanup?.(() => {
    window.clearInterval(timer);
    for (const restore of restored.splice(0).reverse()) {
      restore();
    }
    delete globalThis.__harthmereMobileOverlayPerformanceHotfix;
  });
})();
