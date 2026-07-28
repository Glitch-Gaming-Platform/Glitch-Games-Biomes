import type { GameEvent } from "@/server/shared/api/game_event";
import type { LogicApi } from "@/server/shared/api/logic";
import { LogicContentionError } from "@/server/shared/api/logic";
import type { WorldApi } from "@/server/shared/world/api";
import type { SyncServerContext } from "@/server/sync/context";
import type { ShortCircuit } from "@/server/sync/events/short_circuit";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import type { RegistryLoader } from "@/shared/registry";
import { sleep } from "@/shared/util/async";
import { mapMap } from "@/shared/util/collections";
import {
  CH1_ELSEWHEN_EVICTION_ANCHOR,
  ch1ElsewhenSlotAt,
  isInsideCh1ElsewhenBand,
  isInsideCh1VoidGap,
} from "@/shared/harthmere/ch1_elsewhen_region";
import { readCh1NativeRunAdmission } from "@/shared/harthmere/ch1_native_run";

export type EventCallback = (error?: unknown) => void;
export type EventCb = [GameEvent, EventCallback];

export class CrossClientEventBatcher {
  private readonly pendingEvents: EventCb[] = [];
  private readonly pendingShortCircuits = new Map<BiomesId, ShortCircuit>();
  private lastDrainSuccess = true;

  constructor(
    private readonly logicApi: LogicApi,
    private readonly worldApi: WorldApi
  ) {}

  get size() {
    return this.pendingEvents.length + this.pendingShortCircuits.size;
  }

  push(id: BiomesId, eventCvs: EventCb[], shortCircuit?: ShortCircuit) {
    this.pendingEvents.push(...eventCvs);
    if (shortCircuit?.dirty) {
      this.pendingShortCircuits.set(id, shortCircuit);
    }
  }

  private async sendEvents(batch: EventCb[]) {
    if (batch.length === 0) {
      return;
    }
    try {
      await this.logicApi.publish(...batch.map((e) => e[0]));
      // All succeeded, notify.
      for (const [, cb] of batch) {
        cb();
      }
    } catch (error) {
      if (error instanceof LogicContentionError) {
        // We got partial success, appropriately propagate errors.
        for (const [event, cb] of batch) {
          cb(error.events.includes(event) ? error : undefined);
        }
      } else {
        for (const [, cb] of batch) {
          cb(error);
        }
      }
    }
  }

  private async sendShortCircuits() {
    const batch = new Map(this.pendingShortCircuits);
    this.pendingShortCircuits.clear();
    if (batch.size === 0) {
      return;
    }
    try {
      const entities = await this.worldApi.get([...batch.keys()]);
      for (const entity of entities) {
        if (!entity) continue;
        const shortCircuit = batch.get(entity.id);
        const proposed = shortCircuit?.proposedPosition;
        if (!shortCircuit || !proposed) continue;
        const current = entity.position()?.v;
        const currentSlot = current ? ch1ElsewhenSlotAt(current) : undefined;
        const proposedSlot = ch1ElsewhenSlotAt(proposed);
        const admission = readCh1NativeRunAdmission(entity.triggerState());

        if (proposedSlot) {
          if (
            admission?.dungeonId !== proposedSlot.dungeonId ||
            currentSlot?.dungeonId !== proposedSlot.dungeonId
          ) {
            shortCircuit.forcePosition([...CH1_ELSEWHEN_EVICTION_ANCHOR]);
          }
        } else if (
          currentSlot &&
          admission?.dungeonId === currentSlot.dungeonId
        ) {
          // An admitted run may leave its authored slot only through the
          // signed exit event, which clears the native marker atomically.
          shortCircuit.forcePosition([...current!]);
        } else if (
          isInsideCh1ElsewhenBand(proposed) ||
          isInsideCh1VoidGap(proposed)
        ) {
          shortCircuit.forcePosition([...CH1_ELSEWHEN_EVICTION_ANCHOR]);
        }
      }
      await this.worldApi.apply(
        mapMap(batch, (sc, id) => sc.toChangeToApply(id))
      );
      // If a transaction fails it's due to entity non-existence, so we're
      // fine to clear it anyway.
      for (const sc of batch.values()) {
        sc.clean();
      }
    } catch (error) {
      log.error("Error apply to world - will sleep 250ms", { error });
      await sleep(250);
      for (const [id, sc] of batch.entries()) {
        this.pendingShortCircuits.set(id, sc);
      }
      throw error;
    }
  }

  async flush(): Promise<boolean> {
    if (this.size === 0) {
      return true;
    }
    const batch = this.pendingEvents.splice(0, CONFIG.syncMaxEventBoxCar);
    const results = await Promise.allSettled([
      this.sendEvents(batch),
      this.sendShortCircuits(),
    ]);
    return results.every((r) => r.status === "fulfilled");
  }

  async drain() {
    if (!this.lastDrainSuccess) {
      try {
        await this.logicApi.ping();
      } catch (error) {
        // Not available right now, will try again later.
        return;
      }
    }

    do {
      this.lastDrainSuccess = await this.flush();
    } while (this.size > 0 && this.lastDrainSuccess);
  }
}

export async function registerCrossClientEventBatcher<
  C extends SyncServerContext
>(loader: RegistryLoader<C>) {
  return new CrossClientEventBatcher(
    ...(await Promise.all([loader.get("logicApi"), loader.get("worldApi")]))
  );
}
