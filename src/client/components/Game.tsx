import { BiomesView } from "@/client/components/BiomesView";
import { setCanvasEffect } from "@/client/components/canvas_effects";
import { ClientContextReactContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  PointerLockManager,
  PointerLockManagerContext,
} from "@/client/components/contexts/PointerLockContext";
import { warnAboutBadExtensions } from "@/client/game/browser_extensions";
import type { InitConfigOptions } from "@/client/game/client_config";
import type { ClientContext } from "@/client/game/context";
import type { LoadProgress } from "@/client/game/load_progress";
import { ClientLoader, REQUIRED_FRAMES } from "@/client/game/load_progress";
import { hotResourceEmitter } from "@/client/game/resources/hot";
import { useHarthmereGlitchBridge } from "@/client/game/glitch/harthmere_glitch_bridge";
import { useCutscenePromoCapture } from "@/client/game/cutscene/promo_capture";
import { useHarthmereCutsceneLibrary } from "@/client/game/cutscene/harthmere_library";
import { emitHarthmereGlitchBehaviorEvent } from "@/client/game/glitch/harthmere_glitch_behavior_events";
import { trackConversion } from "@/client/util/ad_helpers";
import { cleanEmitterCallback } from "@/client/util/helpers";
import { useMountedRef } from "@/client/util/hooks";
import { reportFunnelStage } from "@/shared/funnel";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { fireAndForget } from "@/shared/util/async";
import React, { useEffect, useRef, useState } from "react";

const Game: React.FunctionComponent<{
  userId: BiomesId;
  loadProgress: LoadProgress | undefined;
  setLoadProgress: (progress?: LoadProgress) => void;
  configOptions?: InitConfigOptions;
}> = React.memo(({ userId, loadProgress, setLoadProgress, configOptions }) => {
  const [clientContext, setClientContext] = useState<ClientContext | null>(
    null
  );
  const [pointerLockManager] = useState(new PointerLockManager());
  const [error, setError] = useState<Error | undefined>();
  const mounted = useMountedRef();
  const hotVersion = useRef(0);
  const [hotVersionState, setHotVersionState] = useState(0);
  const loadEffectStarted = useRef(false);

  useHarthmereGlitchBridge(Boolean(clientContext), clientContext);
  useHarthmereCutsceneLibrary(clientContext);
  useCutscenePromoCapture(clientContext);

  const startWorldLoadEffect = (context: ClientContext) => {
    if (loadEffectStarted.current) {
      return;
    }
    loadEffectStarted.current = true;
    if (userId) {
      trackConversion("authenticatedLoad");
    }
    setCanvasEffect(context.resources, {
      kind: "worldLoad",
      onComplete: () => {},
    });
  };

  useEffect(() => {
    if (!mounted.current) {
      return;
    }

    const clientLoader = new ClientLoader(
      userId,
      setLoadProgress,
      configOptions,
      (context) => {
        // HARTHMERE_GAME_MOUNT_CONTEXT_BEFORE_RENDER_READY
        // Mount the game canvas as soon as the context exists. The loader still
        // owns the readiness gate, but renderedFrames cannot advance until the
        // canvas is attached to rendererController.
        if (mounted.current) {
          setClientContext(context);
        }
      }
    );

    void (async () => {
      if (!mounted.current) {
        return;
      }

      reportFunnelStage("loadingScreen");
      emitHarthmereGlitchBehaviorEvent("loading", "start");

      try {
        const context = await clientLoader.load();
        emitHarthmereGlitchBehaviorEvent("loading", "complete");
        setClientContext(context);
        startWorldLoadEffect(context);
        setLoadProgress(undefined);
        warnAboutBadExtensions(context.mailman);
      } catch (error: any) {
        // HARTHMERE_LOADER_INTERRUPT_NOT_FATAL: `clientLoader.stop()` rejects the
        // in-flight `load()` with "Client loader interrupted." whenever this effect
        // is torn down (React unmount/remount, e.g. an ancestor <RootErrorBoundary>
        // resetting after a transient hydration error). That is an EXPECTED abort,
        // not a real failure. Previously we always called setError(error), which
        // re-threw below into the error boundary — turning a single transient
        // remount into a cascade: the boundary reset remounts the game, the new
        // loader is interrupted again, the sync stream is torn down, and every
        // subsequent /sync/publish (harvest, eat, mine, place → inventory changes)
        // fails with "Disconnected: finished". Swallow the benign interrupt (and any
        // abort that arrives after we have already unmounted) so a hiccup can no
        // longer kill the live session; only surface genuine load failures.
        const message = String(error?.message ?? error ?? "");
        const isBenignInterrupt =
          !mounted.current ||
          error?.name === "AbortError" ||
          message.includes("Client loader interrupted");
        if (isBenignInterrupt) {
          log.warn(
            `Client load interrupted (benign, likely remount): ${message}`
          );
          return;
        }
        emitHarthmereGlitchBehaviorEvent("loading", "error", {
          message: error?.message ?? String(error),
        });
        log.error("Error while initializing client context", { error: error });
        setError(error);
      }
    })();

    return () => {
      log.warn("Stopping previous game loop, likely due to hot refresh...");
      setClientContext(null);
      fireAndForget(clientLoader.stop());
    };
  }, []);

  useEffect(
    () =>
      cleanEmitterCallback(hotResourceEmitter, {
        onHotResourceReload: () => {
          if (mounted.current) {
            hotVersion.current += 1;
            setHotVersionState(hotVersion.current);
          }
        },
      }),
    []
  );

  // Start load effect a few frames early to avoid a flash of the loading
  const startLoadEffect =
    clientContext && (loadProgress?.sceneRendered ?? 0) > REQUIRED_FRAMES - 5;
  useEffect(() => {
    if (!startLoadEffect || !clientContext) {
      return;
    }
    startWorldLoadEffect(clientContext);
  }, [startLoadEffect]);

  if (error) {
    // Propagate errors during initialization up and let them be caught by a
    // <RootErrorBoundary> installed above.
    throw error;
  }

  // Only progress past the loading screen when we have our clientContext.
  if (!clientContext) {
    return <></>;
  }

  return (
    <ClientContextReactContext.Provider
      value={{ clientContext, setClientContext }}
    >
      <PointerLockManagerContext.Provider
        value={pointerLockManager}
        key={hotVersionState}
      >
        <BiomesView key={hotVersionState} />
      </PointerLockManagerContext.Provider>
    </ClientContextReactContext.Provider>
  );
});

export default Game;
