import { makeEventHandler, RollbackError } from "@/server/logic/events/core";
import { q } from "@/server/logic/events/query";
import { PlayerInventoryEditor } from "@/server/logic/inventory/player_inventory_editor";
import {
  forcePlayerWarp,
  setPlayerHealth,
  startPlayerEmote,
} from "@/server/logic/utils/players";
import { onWarpHomeHook } from "@/server/shared/minigames/logic_hooks";
import { BikkieIds } from "@/shared/bikkie/ids";
import { countOf } from "@/shared/game/items";
import { log } from "@/shared/logging";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import {
  ch1ElsewhenSlot,
  isInsideCh1PortalOnlyRegion,
} from "@/shared/harthmere/ch1_elsewhen_region";
import { readCh1NativeRunAdmission } from "@/shared/harthmere/ch1_native_run";
import { restoreHarthmereNativeVitalsForRespawn } from "@/shared/harthmere/harthmere_native_vitals";
import { harthmereRespawnPositionForDeath } from "@/shared/harthmere/harthmere_respawn_anchors";

export const warpEventHandler = makeEventHandler("warpEvent", {
  mergeKey: (event) => event.id,
  involves: (event) => ({
    player: event.id,
    royaltyTarget: q.optional(event.royaltyTarget)?.includeIced(),
  }),
  apply: ({ player, royaltyTarget }, event, context) => {
    if (
      isInsideCh1PortalOnlyRegion(event.position) ||
      isInsideCh1PortalOnlyRegion(player.position()?.v ?? [0, 0, 0]) ||
      readCh1NativeRunAdmission(player.triggerState())
    ) {
      throw new RollbackError(
        "Elsewhen transitions are possible only through a Chapter 1 fracture gate"
      );
    }
    const playerInventory = new PlayerInventoryEditor(context, player);
    if (!playerInventory.trySpendCurrency(BikkieIds.bling, event.cost)) {
      throw new RollbackError("Tried to warp but didn't have enough dough");
    }

    if (
      royaltyTarget !== undefined &&
      royaltyTarget.id !== player.id &&
      event.royalty
    ) {
      new PlayerInventoryEditor(context, royaltyTarget).giveCurrency(
        BikkieIds.bling,
        event.royalty
      );
    }

    forcePlayerWarp(player, event.position, event.orientation);
    startPlayerEmote(player, { emote_type: "warp" });
  },
});

export const warpHomeEventHandler = makeEventHandler("warpHomeEvent", {
  prepareInvolves: (event) => ({
    player: q.id(event.id),
  }),
  prepare: ({ player }) => ({
    activeMinigameId: player.playing_minigame?.minigame_id,
    activeMinigameInstanceId: player.playing_minigame?.minigame_instance_id,
  }),
  mergeKey: (event) => event.id,
  involves: (event, { activeMinigameId, activeMinigameInstanceId }) => ({
    player: event.id,
    playerActiveMinigame:
      activeMinigameId &&
      q.id(activeMinigameId).with("minigame_component").includeIced(),
    playerActiveMinigameInstance:
      activeMinigameInstanceId &&
      q.id(activeMinigameInstanceId).with("minigame_instance").includeIced(),
  }),
  apply: (
    { player, playerActiveMinigame, playerActiveMinigameInstance },
    { reason, position, orientation },
    context
  ) => {
    const currentChapter1Run = readCh1NativeRunAdmission(player.triggerState());
    if (
      isInsideCh1PortalOnlyRegion(position) ||
      (reason !== "respawn" &&
        (isInsideCh1PortalOnlyRegion(player.position()?.v ?? [0, 0, 0]) ||
          currentChapter1Run))
    ) {
      throw new RollbackError(
        "Elsewhen transitions are possible only through a Chapter 1 fracture gate"
      );
    }
    const nativeHarthmereRespawn =
      reason === "respawn" && nativeBiomesEcsAuthorityEnabled();
    const chapter1Run = currentChapter1Run;
    const chapter1Respawn =
      reason === "respawn" && chapter1Run
        ? ch1ElsewhenSlot(chapter1Run.dungeonId)?.arrival
        : undefined;
    // HARTHMERE_RESPAWN_ANCHORS: this used to send every native respawn to the
    // single Grove point regardless of where the player fell, so dying in
    // Harthmere meant walking the whole connector road back. Resolve against
    // the position the player died at — read BEFORE forcePlayerWarp moves them
    // — and keep the Grove for deaths outside the town. Chapter 1 still wins:
    // a dungeon is in neither Harthmere frame and would otherwise fall through.
    const deathPosition = player.position()?.v;
    const nativeRespawn = nativeHarthmereRespawn
      ? harthmereRespawnPositionForDeath(deathPosition)
      : undefined;
    forcePlayerWarp(
      player,
      chapter1Respawn
        ? [...chapter1Respawn]
        : nativeRespawn
        ? [...nativeRespawn.position]
        : position,
      orientation
    );
    onWarpHomeHook(player, playerActiveMinigameInstance, reason);

    if (reason === "admin") {
      return; // Silent but effective.
    }

    if (reason === "respawn") {
      // Reset health
      if (player.health()?.maxHp) {
        setPlayerHealth(
          player,
          player.health()!.maxHp,
          undefined,
          playerActiveMinigame,
          playerActiveMinigameInstance,
          context
        );
      }

      if (nativeHarthmereRespawn) {
        // Health, position, and survival resources recover in the same native
        // ECS respawn transaction. A player who died at zero stamina therefore
        // cannot arrive at the Grove and immediately die again on heartbeat.
        restoreHarthmereNativeVitalsForRespawn(
          player.mutableTriggerState(),
          Date.now()
        );
      }

      // Skip homestone usage for respawn event
      return;
    }

    const inventory = new PlayerInventoryEditor(context, player);
    const result = inventory.find(countOf(BikkieIds.homestone));
    if (!result) {
      // You don't have a homestone.
      return;
    }
    const [ref] = result;
    if (!inventory.tryUseCharge(ref)) {
      log.warn("Tried to warp home without enough charge");
      return;
    }
  },
});
