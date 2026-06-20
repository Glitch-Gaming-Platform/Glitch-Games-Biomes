export const HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE =
  "harthmere-live-entity-render-motion-bridge";

type LiveEntityPosition = { x: number; y: number; z: number };
export interface HarthmereLiveEntityCombatHealthHud {
  version: typeof HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE;
  entityId: string;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  isAttackable: boolean;
  position?: LiveEntityPosition;
  lastDamageTaken?: number;
  lastAttackedAtMs?: number;
  publishedAtMs: number;
  showUntilMs: number;
}

function finiteNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function parsePosition(value: unknown): LiveEntityPosition | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const x = finiteNumber(record.x);
  const y = finiteNumber(record.y);
  const z = finiteNumber(record.z);
  return x !== undefined && y !== undefined && z !== undefined
    ? { x, y, z }
    : undefined;
}

function motionMode(movementMode: unknown, decision: unknown) {
  const mode = String(movementMode ?? "");
  const text = String(decision ?? "");
  return mode === "combat_chase" || text.includes("retaliate")
    ? "chase"
    : "wander";
}

export function publishHarthmereLiveEntityCombatMotionToRenderer(
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
    __harthmereVoxelNpcMotion?: Record<string, Record<string, unknown>>;
    __harthmereLiveEntityCombatHealth?: Record<
      string,
      HarthmereLiveEntityCombatHealthHud
    >;
    __harthmereLiveEntityRenderMotionBridgeLog?: Array<Record<string, unknown>>;
  };
  let published = 0;
  let skipped = 0;
  for (const [entityId, tick] of Object.entries(ticks)) {
    const from = parsePosition(tick.positionFrom);
    const to = parsePosition(tick.positionTo);
    if (!from || !to) {
      skipped += 1;
      continue;
    }
    const velocity = parsePosition(tick.velocity);
    const speed =
      velocity !== undefined
        ? Math.max(0.05, Math.hypot(velocity.x, velocity.z))
        : Math.max(0.05, Math.hypot(to.x - from.x, to.z - from.z));
    const at = finiteNumber(tick.atMs) ?? nowMs;
    const nextThinkAt = finiteNumber(tick.nextThinkAtMs);
    const durationMs =
      nextThinkAt !== undefined ? Math.max(250, nextThinkAt - at) : 2000;
    const detail = {
      version: HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE,
      source: "harthmere_live_mode_backend_combat_state",
      entityId,
      offset: entityId,
      at,
      mode: motionMode(tick.movementMode, tick.decision),
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
    win.__harthmereVoxelNpcMotion = {
      ...(win.__harthmereVoxelNpcMotion ?? {}),
      [entityId]: detail,
    };
    win.__harthmereLiveEntityRenderMotionBridgeLog = [
      { publishedAtMs: nowMs, ...detail },
      ...(win.__harthmereLiveEntityRenderMotionBridgeLog ?? []),
    ].slice(0, 160);
    published += 1;
  }
  const entitySnapshots =
    state.entitySnapshots && typeof state.entitySnapshots === "object"
      ? (state.entitySnapshots as Record<string, Record<string, unknown>>)
      : {};
  for (const [entityId, entity] of Object.entries(entitySnapshots)) {
    const hp = finiteNumber(entity.hp);
    const maxHp = finiteNumber(entity.maxHp);
    const isDead = entity.isAlive === false || (hp !== undefined && hp <= 0);
    const position = parsePosition(entity.position);
    if (!isDead || !position || maxHp === undefined || maxHp <= 0) {
      continue;
    }
    const at = finiteNumber(entity.defeatedAtMs) ?? nowMs;
    const detail = {
      version: HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE,
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
      facingYaw: finiteNumber(entity.facingYaw),
      navigationResolution: "dead",
      navigationBlocked: true,
    };
    win.__harthmereVoxelNpcMotion = {
      ...(win.__harthmereVoxelNpcMotion ?? {}),
      [entityId]: detail,
    };
    win.__harthmereLiveEntityRenderMotionBridgeLog = [
      { publishedAtMs: nowMs, ...detail },
      ...(win.__harthmereLiveEntityRenderMotionBridgeLog ?? []),
    ].slice(0, 160);
    published += 1;
  }
  const healthEntries: Record<string, HarthmereLiveEntityCombatHealthHud> = {
    ...(win.__harthmereLiveEntityCombatHealth ?? {}),
  };
  for (const [entityId, entity] of Object.entries(entitySnapshots)) {
    const hp = finiteNumber(entity.hp);
    const maxHp = finiteNumber(entity.maxHp);
    if (hp === undefined || maxHp === undefined || maxHp <= 0) {
      continue;
    }
    const lastAttackedAtMs = finiteNumber(entity.lastAttackedAtMs);
    const lastDamageTaken = finiteNumber(entity.lastDamageTaken);
    const damaged = hp < maxHp;
    const recentlyDamaged =
      lastAttackedAtMs !== undefined && nowMs - lastAttackedAtMs < 20_000;
    if (!damaged && !recentlyDamaged) {
      continue;
    }
    healthEntries[entityId] = {
      version: HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE,
      entityId,
      hp: Math.max(0, Math.trunc(hp)),
      maxHp: Math.max(1, Math.trunc(maxHp)),
      isAlive: entity.isAlive === false ? false : hp > 0,
      isAttackable: entity.isAttackable === false ? false : true,
      position: parsePosition(entity.position),
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
  win.__harthmereLiveEntityCombatHealth = healthEntries;
  return { published, skipped };
}
