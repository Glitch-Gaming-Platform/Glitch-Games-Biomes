export const HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE_V1 =
  "harthmere-live-entity-render-motion-bridge-v1";

type LiveEntityPositionV1 = { x: number; y: number; z: number };

function finiteNumberV1(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function positionV1(value: unknown): LiveEntityPositionV1 | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const x = finiteNumberV1(record.x);
  const y = finiteNumberV1(record.y);
  const z = finiteNumberV1(record.z);
  return x !== undefined && y !== undefined && z !== undefined
    ? { x, y, z }
    : undefined;
}

function motionModeV1(movementMode: unknown, decision: unknown) {
  const mode = String(movementMode ?? "");
  const text = String(decision ?? "");
  return mode === "combat_chase" || text.includes("retaliate")
    ? "chase"
    : "wander";
}

export function publishHarthmereLiveEntityCombatMotionToRendererV1(
  combatState: unknown,
  nowMs = Date.now()
) {
  if (typeof window === "undefined" || !combatState || typeof combatState !== "object") {
    return { published: 0, skipped: 0 };
  }
  const state = combatState as Record<string, unknown>;
  const ticks =
    state.npcAiTicks && typeof state.npcAiTicks === "object"
      ? (state.npcAiTicks as Record<string, Record<string, unknown>>)
      : {};
  const win = window as typeof window & {
    __harthmereVoxelNpcMotionV193?: Record<string, Record<string, unknown>>;
    __harthmereLiveEntityRenderMotionBridgeLogV1?: Array<Record<string, unknown>>;
  };
  let published = 0;
  let skipped = 0;
  for (const [entityId, tick] of Object.entries(ticks)) {
    const from = positionV1(tick.positionFrom);
    const to = positionV1(tick.positionTo);
    if (!from || !to) {
      skipped += 1;
      continue;
    }
    const velocity = positionV1(tick.velocity);
    const speed =
      velocity !== undefined
        ? Math.max(0.05, Math.hypot(velocity.x, velocity.z))
        : Math.max(0.05, Math.hypot(to.x - from.x, to.z - from.z));
    const at = finiteNumberV1(tick.atMs) ?? nowMs;
    const nextThinkAt = finiteNumberV1(tick.nextThinkAtMs);
    const durationMs =
      nextThinkAt !== undefined ? Math.max(250, nextThinkAt - at) : 2000;
    const detail = {
      version: HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE_V1,
      source: "harthmere_live_mode_backend_combat_state",
      entityId,
      offset: entityId,
      at,
      mode: motionModeV1(tick.movementMode, tick.decision),
      reason: String(tick.decision ?? "live_entity_ai_tick"),
      from: [from.x, from.z],
      playerPos: [to.x, to.z],
      targetPos: [to.x, to.z],
      speed,
      stopDistance: 0.05,
      durationMs,
      animationState: tick.animationState,
      animationMoving: tick.animationMoving,
      facingYaw: tick.facingYaw,
      navigationResolution: tick.navigationResolution,
      navigationBlocked: tick.navigationBlocked,
    };
    win.__harthmereVoxelNpcMotionV193 = {
      ...(win.__harthmereVoxelNpcMotionV193 ?? {}),
      [entityId]: detail,
    };
    win.__harthmereLiveEntityRenderMotionBridgeLogV1 = [
      { publishedAtMs: nowMs, ...detail },
      ...(win.__harthmereLiveEntityRenderMotionBridgeLogV1 ?? []),
    ].slice(0, 160);
    published += 1;
  }
  return { published, skipped };
}
