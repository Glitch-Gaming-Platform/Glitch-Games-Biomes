import * as React from "react";
import { usePointerLockUnlockWhileOpenActive } from "@/client/components/contexts/usePointerLockUnlockWhileOpenActive";
import { HarthmereBusinessInterfacePanel } from "./HarthmereBusinessInterfacePanel";
import { HarthmereBusinessInteractionPrompt } from "./HarthmereBusinessInteractionPrompt";
import {
  createHarthmereBusinessInterfaceAdapter,
  fetchHarthmereBusinessEconomyState,
  harthmereBusinessWorldContextPayload,
  nearestHarthmereBusinessDashboardWorldContext,
  submitHarthmereBusinessEconomyMutation,
  type HarthmereBusinessEconomySnapshot,
  type HarthmereBusinessWorldContext,
  type HarthmereBusinessWorldPoint,
} from "./businessInterfaceLiveAdapter";

export interface HarthmereBusinessLiveContainerProps {
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  showPrompt?: boolean;
  playerPosition?: HarthmereBusinessWorldPoint;
  worldContext?: HarthmereBusinessWorldContext;
  initialState?: HarthmereBusinessEconomySnapshot;
}

// HARTHMERE_BUSINESS_NO_REMOUNT_ON_ACTION
// Pure model of how a single refresh() should drive the blocking `loading`
// flag. Only the very first hydration shows the loading board; every
// post-mutation refresh (after each serve / owner action) must be silent so the
// adapter stays hydrated, the interaction prompt stays visible, and the open
// panel is never torn down and rebuilt between clicks.
export interface HarthmereBusinessRefreshLoadingPlan {
  showLoadingAtStart: boolean;
  clearLoadingWhenSettled: boolean;
  hasLoadedAfter: boolean;
}

export function planHarthmereBusinessRefreshLoading(
  hasLoadedBefore: boolean
): HarthmereBusinessRefreshLoadingPlan {
  const isInitialLoad = !hasLoadedBefore;
  return {
    showLoadingAtStart: isInitialLoad,
    clearLoadingWhenSettled: isInitialLoad,
    hasLoadedAfter: true,
  };
}

function isTypingInBusinessInput(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  const tagName = element?.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element?.isContentEditable === true
  );
}

export function mergeHarthmereBusinessWorldContext(
  explicitContext: HarthmereBusinessWorldContext | undefined,
  inferredContext: HarthmereBusinessWorldContext | undefined
): HarthmereBusinessWorldContext {
  const explicit = explicitContext ?? {};
  const inferred = inferredContext ?? {};
  const explicitBusinessId = explicit.nearbyBusinessId;
  const inferredBusinessId = inferred.nearbyBusinessId;
  const canUseInferred =
    Boolean(inferredBusinessId) &&
    (!explicitBusinessId || explicitBusinessId === inferredBusinessId);
  const base = explicitBusinessId ? explicit : canUseInferred ? inferred : {};
  if (!base.nearbyBusinessId) return base;
  const supplement = canUseInferred ? inferred : {};
  return {
    ...supplement,
    ...base,
    nearbyBusinessId: base.nearbyBusinessId,
    interactionKeyLabel:
      base.interactionKeyLabel ?? supplement.interactionKeyLabel ?? "F",
    insideBusiness: base.insideBusiness ?? supplement.insideBusiness,
    outpostId: base.outpostId ?? supplement.outpostId,
    businessInteractionMarkerId:
      base.businessInteractionMarkerId ??
      supplement.businessInteractionMarkerId,
    businessInteractionPosition:
      base.businessInteractionPosition ??
      supplement.businessInteractionPosition,
  };
}

export function HarthmereBusinessLiveContainer({
  open = false,
  onOpen,
  onClose,
  showPrompt = true,
  playerPosition,
  worldContext,
  initialState,
}: HarthmereBusinessLiveContainerProps) {
  const [state, setState] = React.useState<
    HarthmereBusinessEconomySnapshot | undefined
  >(initialState);
  const [loading, setLoading] = React.useState(!initialState);
  const [error, setError] = React.useState<string | undefined>();
  const anyUiOpen = usePointerLockUnlockWhileOpenActive();
  // HARTHMERE_BUSINESS_NO_REMOUNT_ON_ACTION
  // Only the very first hydration should flip the blocking `loading` flag.
  // Post-mutation refreshes (fired after every serve / owner action) must be
  // silent: toggling `loading` un-hydrates the adapter, which transiently hides
  // the interaction prompt and makes the close-effect tear the open panel down
  // and rebuild it between every click. A silent background refresh keeps the
  // panel mounted and lets the in-panel transitions animate instead.
  const hasLoadedRef = React.useRef<boolean>(Boolean(initialState));

  const refresh = React.useCallback(async () => {
    const plan = planHarthmereBusinessRefreshLoading(hasLoadedRef.current);
    if (plan.showLoadingAtStart) setLoading(true);
    setError(undefined);
    try {
      const next = await fetchHarthmereBusinessEconomyState();
      hasLoadedRef.current = plan.hasLoadedAfter;
      setState(next);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return undefined;
    } finally {
      if (plan.clearLoadingWhenSettled) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!initialState) void refresh();
  }, [initialState, refresh]);

  const context = React.useMemo(() => {
    const inferred = nearestHarthmereBusinessDashboardWorldContext(
      state,
      playerPosition,
      9
    );
    const next = mergeHarthmereBusinessWorldContext(worldContext, inferred);
    return next.nearbyBusinessId
      ? {
          ...next,
          interactionKeyLabel: next.interactionKeyLabel ?? "F",
        }
      : next;
  }, [playerPosition, state, worldContext]);

  const adapter = React.useMemo(
    () =>
      createHarthmereBusinessInterfaceAdapter({
        state,
        hydrated: !loading,
        setState,
        refresh,
        submit: (operation, payload) =>
          submitHarthmereBusinessEconomyMutation(operation, {
            ...harthmereBusinessWorldContextPayload(context),
            ...payload,
          }),
      }),
    [context, loading, refresh, state]
  );

  const prompt = React.useMemo(
    () =>
      state
        ? adapter.getInteractionPrompt(context)
        : { visible: false, label: "", helper: "", keyLabel: "E" },
    [adapter, context, state]
  );
  const canShowWorldPrompt = showPrompt && !open && !anyUiOpen;

  React.useEffect(() => {
    if (!open || prompt.visible || !state) return;
    onClose?.();
  }, [onClose, open, prompt.visible, state]);

  React.useEffect(() => {
    if (
      !prompt.visible ||
      !canShowWorldPrompt ||
      !onOpen ||
      typeof window === "undefined"
    ) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingInBusinessInput(event.target)
      ) {
        return;
      }
      if (event.code === "KeyE" || event.code === "KeyF") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [canShowWorldPrompt, onOpen, prompt.visible]);

  if (!state && (loading || !error)) return null;

  return (
    <>
      {canShowWorldPrompt ? (
        <HarthmereBusinessInteractionPrompt
          adapter={adapter}
          context={context}
          onInteract={() => onOpen?.()}
        />
      ) : null}
      {open ? (
        <HarthmereBusinessInterfacePanel
          adapter={adapter}
          nearbyBusinessId={context.nearbyBusinessId}
          context={context}
          initialTab="overview"
          onClose={onClose}
        />
      ) : null}
    </>
  );
}
