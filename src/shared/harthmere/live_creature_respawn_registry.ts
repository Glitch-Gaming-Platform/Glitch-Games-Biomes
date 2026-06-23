// HARTHMERE_LIVE_CREATURE_RESPAWN_REGISTRY
//
// The live-entity seed reconciler recreates any required creature whose entity
// is currently absent from the world. Without a respawn gate, a killed mucker
// would pop straight back on the next reconcile tick. This registry records the
// time of each kill and reports which creature ids are still "cooling down" so
// the seeder can leave them dead until their one-hour respawn window passes.
//
// Pure/stateful but DOM- and IO-free, so it is fully unit-testable. The actual
// wiring is: the combat death path calls recordKill(id); the seed builder asks
// isSuppressed(id, now) before re-creating a creature.

import {
  harthmereLiveCreatureRespawnAt,
  harthmereLiveCreatureShouldRespawn,
} from "@/shared/harthmere/live_creature_render";

export class HarthmereLiveCreatureRespawnRegistry<TId = number> {
  private readonly respawnAtById = new Map<TId, number>();

  /**
   * Record that a creature was killed at `nowMs`; it becomes eligible to respawn
   * one hour later. `rng` is injectable for deterministic tests.
   */
  recordKill(id: TId, nowMs: number, rng?: () => number): number {
    const respawnAtMs = harthmereLiveCreatureRespawnAt({
      killedAtMs: nowMs,
      rng,
    });
    this.respawnAtById.set(id, respawnAtMs);
    return respawnAtMs;
  }

  /** When is this creature scheduled to respawn (undefined = not dead). */
  respawnAt(id: TId): number | undefined {
    return this.respawnAtById.get(id);
  }

  /**
   * True while a killed creature is still within its respawn cooldown and must
   * not be re-seeded yet.
   */
  isSuppressed(id: TId, nowMs: number): boolean {
    const respawnAtMs = this.respawnAtById.get(id);
    if (respawnAtMs === undefined) {
      return false;
    }
    // Cooldown elapsed -> let it respawn and forget the record.
    if (harthmereLiveCreatureShouldRespawn({ nowMs, respawnAtMs })) {
      this.respawnAtById.delete(id);
      return false;
    }
    return true;
  }

  /** Drop all records whose respawn time has passed (housekeeping). */
  pruneElapsed(nowMs: number): void {
    for (const [id, respawnAtMs] of [...this.respawnAtById.entries()]) {
      if (harthmereLiveCreatureShouldRespawn({ nowMs, respawnAtMs })) {
        this.respawnAtById.delete(id);
      }
    }
  }

  /** Ids still cooling down at `nowMs`. */
  suppressedIds(nowMs: number): TId[] {
    const ids: TId[] = [];
    for (const id of this.respawnAtById.keys()) {
      if (this.isSuppressed(id, nowMs)) {
        ids.push(id);
      }
    }
    return ids;
  }

  /** Force a creature back to life immediately (e.g. admin / event). */
  clear(id: TId): void {
    this.respawnAtById.delete(id);
  }

  get size(): number {
    return this.respawnAtById.size;
  }
}

// Process-wide registry the server seed reconciler + combat death path share.
let sharedRegistry: HarthmereLiveCreatureRespawnRegistry | undefined;

export function harthmereSharedLiveCreatureRespawnRegistry(): HarthmereLiveCreatureRespawnRegistry {
  if (!sharedRegistry) {
    sharedRegistry = new HarthmereLiveCreatureRespawnRegistry();
  }
  return sharedRegistry;
}
