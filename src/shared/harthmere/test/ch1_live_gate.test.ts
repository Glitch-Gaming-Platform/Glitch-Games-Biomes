/// <reference types="mocha" />
import assert from "assert";
import {
  ch1ActiveDungeonGateIdsFromNativeChallenges,
  ch1ProvisioningCarriedFromInventory,
  defaultCh1LiveGateRuntimeState,
  normalizeCh1LiveGateRuntimeState,
} from "@/shared/harthmere/ch1_live_gate";
import { ch1CheckProvisioning } from "@/shared/harthmere/ch1_fracture_gates";
import { ch1NativeQuestId } from "@/shared/harthmere/ch1_native_quests";

describe("Chapter 1 live gate projection", () => {
  it("opens persistent dungeon gates only after their prior acts", () => {
    const act3 = ch1NativeQuestId("ch1_a3_q01_a_button_in_the_sand")!;
    const act5 = ch1NativeQuestId("ch1_a5_q01_the_ledger_goes_quiet")!;
    assert.deepEqual(
      ch1ActiveDungeonGateIdsFromNativeChallenges({
        inProgress: new Set([act3]),
        complete: new Set(),
      }),
      ["ch1_gate_desert"]
    );
    assert.deepEqual(
      ch1ActiveDungeonGateIdsFromNativeChallenges({
        inProgress: new Set([act5]),
        complete: new Set([act3]),
      }),
      ["ch1_gate_desert", "ch1_gate_winter"]
    );
  });

  it("projects actual inventory ids into every provisioning family", () => {
    const carried = ch1ProvisioningCarriedFromInventory({
      clean_water: 12,
      bread: 10,
      worker_meal: 6,
      herb_bundle: 8,
      torch: 10,
      repair_kit: 2,
      bandage: 6,
      coal: 18,
      winter_coat: 1,
      rope_coil: 4,
      iron_ingot: 6,
    });
    assert.deepEqual(carried, {
      water: 12,
      food: 10,
      cooked: 6,
      forage: 8,
      light: 10,
      repair_kit: 2,
      bandage: 6,
      fuel: 18,
      cold_gear: 1,
      rope: 4,
      iron: 6,
    });
  });

  it("accepts the canonical economy items for both authored pack checks", () => {
    const carried = ch1ProvisioningCarriedFromInventory({
      clean_water: 12,
      road_ration: 20,
      hearty_stew: 12,
      herb_bundle: 8,
      wall_lantern: 10,
      road_repair_kit: 3,
      field_medkit: 10,
      coal: 18,
      patched_cloak: 1,
      rope: 4,
      iron_ingot: 6,
    });
    assert.equal(ch1CheckProvisioning("ch1_gate_desert", carried).ok, true);
    assert.equal(ch1CheckProvisioning("ch1_gate_winter", carried).ok, true);
  });

  it("normalizes old or malformed save branches without accepting bad warps", () => {
    assert.deepEqual(
      normalizeCh1LiveGateRuntimeState(undefined).completionFlags,
      defaultCh1LiveGateRuntimeState().completionFlags
    );
    const normalized = normalizeCh1LiveGateRuntimeState({
      activeDungeonRunId: "ch1_dungeon_desert",
      activeGateId: "ch1_gate_desert",
      activeRunStartedMs: 10,
      returnPosition: [648, 59, -462],
      completionFlags: ["one", "one", 3],
    });
    assert.deepEqual(normalized, {
      ...defaultCh1LiveGateRuntimeState(),
      ending: undefined,
      hallrChoice: undefined,
      activeDungeonRunId: "ch1_dungeon_desert",
      activeGateId: "ch1_gate_desert",
      activeRunStartedMs: 10,
      returnPosition: [648, 59, -462],
      completionFlags: ["one"],
    });
    assert.equal(
      normalizeCh1LiveGateRuntimeState({ returnPosition: [1, "bad", 3] })
        .returnPosition,
      undefined
    );
  });
});
