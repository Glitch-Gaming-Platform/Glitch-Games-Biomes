(() => {
  let cleanupInstalledHotfix = () => {};

  const finitePosition = (value) =>
    Array.isArray(value) &&
    value.length >= 3 &&
    value.slice(0, 3).every((part) => Number.isFinite(Number(part)));

  const install = () => {
    const observerKey = "__biomesObserverStreamingDebug";
    const previousObserverDescriptor = Object.getOwnPropertyDescriptor(
      window,
      observerKey
    );
    let currentObserver = previousObserverDescriptor?.get
      ? previousObserverDescriptor.get.call(window)
      : window[observerKey];

    Object.defineProperty(window, observerKey, {
      configurable: true,
      enumerable: true,
      get() {
        if (!currentObserver) return currentObserver;
        let position;
        try {
          position = currentObserver.getPosition?.();
        } catch {
          position = undefined;
        }
        const hasLivePlayerAuthority =
          typeof window.__harthmereLivePlayerDebug?.teleportTo === "function";
        if (finitePosition(position) && !hasLivePlayerAuthority) {
          return currentObserver;
        }
        return {
          getPosition: currentObserver.getPosition?.bind(currentObserver),
          // A coordinate-less /at route publishes the observer bridge before
          // it owns a position. An authenticated player route can publish both
          // bridges, but runtime scenery follows the player. Hiding moveTo in
          // either case makes promo capture use the correct authority.
          moveTo: undefined,
        };
      },
      set(value) {
        currentObserver = value;
      },
    });

    const streamingKey = "__harthmereMobileRuntimeStreaming";
    const previousStreamingDescriptor = Object.getOwnPropertyDescriptor(
      window,
      streamingKey
    );
    let currentStreaming = previousStreamingDescriptor?.get
      ? previousStreamingDescriptor.get.call(window)
      : window[streamingKey];
    Object.defineProperty(window, streamingKey, {
      configurable: true,
      enumerable: true,
      get() {
        const playerPosition =
          window.__harthmereLivePlayerDebug?.getPosition?.();
        if (!currentStreaming || !finitePosition(playerPosition)) {
          return currentStreaming;
        }
        return {
          ...currentStreaming,
          captureCameraOrigin: currentStreaming.origin,
          origin: [Number(playerPosition[0]), Number(playerPosition[2])],
        };
      },
      set(value) {
        currentStreaming = value;
      },
    });

    return () => {
      delete window[observerKey];
      if (previousObserverDescriptor) {
        Object.defineProperty(
          window,
          observerKey,
          previousObserverDescriptor
        );
      } else if (currentObserver !== undefined) {
        window[observerKey] = currentObserver;
      }

      delete window[streamingKey];
      if (previousStreamingDescriptor) {
        Object.defineProperty(
          window,
          streamingKey,
          previousStreamingDescriptor
        );
      } else if (currentStreaming !== undefined) {
        window[streamingKey] = currentStreaming;
      }
    };
  };

  // The mutable loader invokes the previous payload's cleanup after evaluating
  // this script. Install in the next microtask so an updated payload cannot be
  // erased by that intentional cleanup ordering.
  queueMicrotask(() => {
    cleanupInstalledHotfix = install();
  });

  window.__biomesGlitchMutableHotfix?.registerCleanup(() => {
    cleanupInstalledHotfix();
  });
})();
