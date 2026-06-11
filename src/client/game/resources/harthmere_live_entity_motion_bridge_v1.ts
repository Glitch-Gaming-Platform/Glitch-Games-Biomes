export const HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE_V1 =
  "harthmere-live-entity-render-motion-bridge-v1";

type LiveEntityPositionV1 = { x: number; y: number; z: number };
export interface HarthmereLiveEntityCombatHealthHudV1 {
  version: typeof HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE_V1;
  entityId: string;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  isAttackable: boolean;
  position?: LiveEntityPositionV1;
  lastDamageTaken?: number;
  lastAttackedAtMs?: number;
  publishedAtMs: number;
  showUntilMs: number;
}

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
    __harthmereLiveEntityCombatHealthV1?: Record<
      string,
      HarthmereLiveEntityCombatHealthHudV1
    >;
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
  const entitySnapshots =
    state.entitySnapshots && typeof state.entitySnapshots === "object"
      ? (state.entitySnapshots as Record<string, Record<string, unknown>>)
      : {};
  for (const [entityId, entity] of Object.entries(entitySnapshots)) {
    const hp = finiteNumberV1(entity.hp);
    const maxHp = finiteNumberV1(entity.maxHp);
    const isDead = entity.isAlive === false || (hp !== undefined && hp <= 0);
    const position = positionV1(entity.position);
    if (!isDead || !position || maxHp === undefined || maxHp <= 0) {
      continue;
    }
    const at = finiteNumberV1(entity.defeatedAtMs) ?? nowMs;
    const detail = {
      version: HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE_V1,
      source: "harthmere_live_mode_backend_combat_state",
      entityId,
      offset: entityId,
      at,
      mode: "wander",
      reason: "live_entity_dead_stop",
      from: [position.x, position.z],
      playerPos: [position.x, position.z],
      targetPos: [position.x, position.z],
      speed: 0,
      stopDistance: 0,
      durationMs: 1_000,
      animationState: "death",
      animationMoving: false,
      facingYaw: finiteNumberV1(entity.facingYaw),
      navigationResolution: "dead",
      navigationBlocked: true,
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
  const healthEntries: Record<string, HarthmereLiveEntityCombatHealthHudV1> = {
    ...(win.__harthmereLiveEntityCombatHealthV1 ?? {}),
  };
  for (const [entityId, entity] of Object.entries(entitySnapshots)) {
    const hp = finiteNumberV1(entity.hp);
    const maxHp = finiteNumberV1(entity.maxHp);
    if (hp === undefined || maxHp === undefined || maxHp <= 0) {
      continue;
    }
    const lastAttackedAtMs = finiteNumberV1(entity.lastAttackedAtMs);
    const lastDamageTaken = finiteNumberV1(entity.lastDamageTaken);
    const damaged = hp < maxHp;
    const recentlyDamaged =
      lastAttackedAtMs !== undefined && nowMs - lastAttackedAtMs < 20_000;
    if (!damaged && !recentlyDamaged) {
      continue;
    }
    healthEntries[entityId] = {
      version: HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE_V1,
      entityId,
      hp: Math.max(0, Math.trunc(hp)),
      maxHp: Math.max(1, Math.trunc(maxHp)),
      isAlive: entity.isAlive === false ? false : hp > 0,
      isAttackable: entity.isAttackable === false ? false : true,
      position: positionV1(entity.position),
      lastDamageTaken,
      lastAttackedAtMs,
      publishedAtMs: nowMs,
      showUntilMs: nowMs + 20_000,
    };
  }
  for (const [entityId, health] of Object.entries(healthEntries)) {
    if (health.showUntilMs < nowMs) {
      delete healthEntries[entityId];
    }
  }
  win.__harthmereLiveEntityCombatHealthV1 = healthEntries;
  return { published, skipped };
}
