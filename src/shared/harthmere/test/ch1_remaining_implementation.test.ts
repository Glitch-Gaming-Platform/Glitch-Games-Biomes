/// <reference types="mocha" />

import assert from "assert";
import { TriggerState, WorldMetadata } from "@/shared/ecs/gen/components";
import { CollisionHelper } from "@/shared/game/collision";
import {
  CH1_DUNGEON_ENCOUNTER_NPCS,
  CH1_DUNGEON_ESCORT_NPCS,
  CH1_NINTH_WINTER_LOOP_MS,
  ch1GildedBullBrokenPartIds,
  ch1GildedBullPhase,
  ch1NinthWinterPhase,
  ch1EscortIsUnkillable,
  ch1OptionalEscortNpcsForObjective,
  ch1RequiredEncounterNpcsForObjective,
  ch1RequiredEscortNpcsForObjective,
} from "@/shared/harthmere/ch1_dungeon_encounters";
import {
  CH1_ELSEWHEN_BAND_END_X,
  CH1_ELSEWHEN_BAND_START_X,
  ch1GaiaManagesTerrainAt,
  ch1DetachedWorldBoundsAt,
  ch1ElsewhenSlot,
  ch1ElsewhenSlotAt,
  ch1NormalizeOrdinaryWorldEastEdge,
  isInsideCh1PortalOnlyRegion,
} from "@/shared/harthmere/ch1_elsewhen_region";
import { defaultCh1LiveGateRuntimeState } from "@/shared/harthmere/ch1_live_gate";
import {
  ch1ApplyLiveObjectiveEffects,
  ch1UseLiveLatentSkill,
} from "@/shared/harthmere/ch1_live_story";
import {
  clearCh1NativeRunAdmission,
  ch1NativeRunAdmitsPosition,
  readCh1NativeRunAdmission,
  writeCh1NativeRunAdmission,
} from "@/shared/harthmere/ch1_native_run";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";
import { CH1_FLAGS } from "@/shared/harthmere/ch1_ids";
import {
  CH1_PARTY_SELF_RECOVERY_MS,
  CH1_SOLO_OR_WIPE_RECOVERY_MS,
  ch1DownedRecoveryDelayMs,
} from "@/shared/harthmere/ch1_party";
import {
  CH1_SOUND_HUNTER_MIN_SPEED,
  chapter1SoundHunterCanHear,
} from "@/shared/npc/behavior/chase_attack";
import { npcIsInsideWorldBounds } from "@/shared/npc/logic";

describe("Chapter 1 remaining implementation contracts", () => {
  it("places every native encounter in its own portal-only dungeon slot", () => {
    assert.equal(CH1_DUNGEON_ENCOUNTER_NPCS.length, 12);
    for (const npc of CH1_DUNGEON_ENCOUNTER_NPCS) {
      assert.equal(ch1ElsewhenSlotAt(npc.position)?.dungeonId, npc.dungeonId);
      assert.ok(npc.maxHp > 0);
    }
  });

  it("keeps Elsewhen detached from ordinary world metadata and physics", () => {
    assert.equal(
      ch1NormalizeOrdinaryWorldEastEdge(CH1_ELSEWHEN_BAND_END_X),
      2560
    );
    assert.equal(ch1NormalizeOrdinaryWorldEastEdge(4096), 4096);
    assert.equal(isInsideCh1PortalOnlyRegion([2580, 64, 0]), true);
    assert.equal(
      isInsideCh1PortalOnlyRegion([CH1_ELSEWHEN_BAND_START_X, 64, 0]),
      true
    );

    const slot = ch1ElsewhenSlot("ch1_dungeon_desert")!;
    assert.equal(ch1GaiaManagesTerrainAt(slot.arrival), false);
    assert.equal(ch1GaiaManagesTerrainAt([2100, 53, -284]), true);
    assert.deepEqual(ch1DetachedWorldBoundsAt(slot.arrival)?.v0, [
      slot.minX,
      -64,
      -512,
    ]);
    const metadata = WorldMetadata.create({
      aabb: { v0: [-1792, -224, -1792], v1: [2560, 288, 1792] },
    });
    const safeHits: unknown[] = [];
    CollisionHelper.intersectWorldBounds(
      metadata,
      [
        [slot.arrival[0] - 0.5, slot.arrival[1], slot.arrival[2] - 0.5],
        [slot.arrival[0] + 0.5, slot.arrival[1] + 2, slot.arrival[2] + 0.5],
      ],
      (hit) => safeHits.push(hit)
    );
    assert.equal(
      safeHits.length,
      0,
      "the ordinary east wall must not fill an admitted detached dungeon"
    );

    const slotEdgeHits: unknown[] = [];
    CollisionHelper.intersectWorldBounds(
      metadata,
      [
        [slot.maxX - 2, 64, -1],
        [slot.maxX + 1, 66, 1],
      ],
      (hit) => slotEdgeHits.push(hit)
    );
    assert.ok(slotEdgeHits.length > 0, "the detached slot keeps its own wall");

    assert.equal(
      npcIsInsideWorldBounds(metadata, slot.arrival),
      true,
      "Anima must not kill authored dungeon NPCs outside ordinary metadata"
    );
    assert.equal(
      npcIsInsideWorldBounds(metadata, [CH1_ELSEWHEN_BAND_START_X - 16, 64, 0]),
      false,
      "the unassigned gap before a detached slot is still out of bounds"
    );
  });

  it("requires native kills only for authored combat routes", () => {
    assert.equal(
      ch1RequiredEncounterNpcsForObjective("d1_salt_market", "fight_open")
        .length,
      3
    );
    assert.equal(
      ch1RequiredEncounterNpcsForObjective("d1_salt_market", "drop_awnings")
        .length,
      0
    );
    assert.equal(
      ch1RequiredEncounterNpcsForObjective("d1_sun_court", "break_horns")
        .length,
      1
    );
    assert.equal(
      ch1RequiredEncounterNpcsForObjective("d2_ash_hall", "feed_hearth").length,
      1
    );
  });

  it("authors the two native escort parties and their completion gates", () => {
    assert.deepEqual(
      CH1_DUNGEON_ESCORT_NPCS.map((npc) => npc.displayName),
      ["Iris Fen", "Marrow", "Dr. Nadia Sorrel"]
    );
    // MARROW IS OPTIONAL. ch1_dungeons.ts marks the Marrow retrieval
    // `required: false` ("Optional and cruel to make optional"), and this
    // assertion used to demand both desert escorts at the aperture — which made
    // the dog mandatory in the runtime and, because `d1_the_long_walk` is what
    // sets `ch1_iris_rescued`, made a lost dog an unrecoverable soft-lock.
    assert.deepEqual(
      ch1RequiredEscortNpcsForObjective("d1_the_long_walk").map(
        (npc) => npc.displayName
      ),
      ["Iris Fen"]
    );
    assert.deepEqual(
      ch1OptionalEscortNpcsForObjective("d1_the_long_walk").map(
        (npc) => npc.displayName
      ),
      ["Marrow"]
    );
    assert.equal(
      ch1RequiredEscortNpcsForObjective("d2_the_breaking_year").length,
      1
    );
  });

  it("makes every dungeon escort unkillable, not just documented as such", () => {
    // ANIMA RULE 3 in ch1_engine_contracts.ts calls Iris, Sorrel and Marrow
    // "unkillable, non-negotiable". Before this, the only enforcement was a
    // name-substring scan over encounter strings; the ECS had no idea.
    for (const npc of CH1_DUNGEON_ESCORT_NPCS) {
      assert.ok(
        ch1EscortIsUnkillable(npc.entityId),
        `${npc.displayName} must be unkillable`
      );
    }
    assert.equal(ch1EscortIsUnkillable(1 as never), false);
  });

  it("drives sound-hunting enemies from movement noise or native threat", () => {
    assert.equal(
      chapter1SoundHunterCanHear({ velocity: [0, 0, 0], threat: 0 }),
      false
    );
    assert.equal(
      chapter1SoundHunterCanHear({
        velocity: [CH1_SOUND_HUNTER_MIN_SPEED, 0, 0],
        threat: 0,
      }),
      true
    );
    assert.equal(
      chapter1SoundHunterCanHear({ velocity: [0, 0, 0], threat: 1 }),
      true
    );
  });

  it("persists the Bull's horn phases and the Ninth Winter's ninety-second loop", () => {
    assert.deepEqual(ch1GildedBullBrokenPartIds({ hp: 420, maxHp: 420 }), []);
    const oneHorn = ch1GildedBullBrokenPartIds({ hp: 290, maxHp: 420 });
    assert.deepEqual(oneHorn, ["left_horn"]);
    const bothHorns = ch1GildedBullBrokenPartIds({
      hp: 180,
      maxHp: 420,
      existing: oneHorn,
    });
    assert.deepEqual(bothHorns, ["left_horn", "right_horn"]);
    assert.equal(
      ch1GildedBullPhase({
        hp: 180,
        maxHp: 420,
        brokenPartIds: bothHorns,
      }),
      "unbalanced"
    );
    assert.equal(
      ch1NinthWinterPhase({
        hp: 560,
        maxHp: 560,
        cycleStartedAtMs: 1_000,
        nowMs: 1_000 + CH1_NINTH_WINTER_LOOP_MS - 1,
      }),
      "same_day_again"
    );
    assert.equal(
      ch1NinthWinterPhase({
        hp: 160,
        maxHp: 560,
        cycleStartedAtMs: 1_000,
        nowMs: 10_000,
      }),
      "year_breaks"
    );
  });

  it("keeps party revive meaningful without allowing dungeon death soft-locks", () => {
    assert.equal(
      ch1DownedRecoveryDelayMs({
        memberCount: 1,
        allPresentMembersDown: true,
      }),
      CH1_SOLO_OR_WIPE_RECOVERY_MS
    );
    assert.equal(
      ch1DownedRecoveryDelayMs({
        memberCount: 4,
        allPresentMembersDown: true,
      }),
      CH1_SOLO_OR_WIPE_RECOVERY_MS
    );
    assert.equal(
      ch1DownedRecoveryDelayMs({
        memberCount: 4,
        allPresentMembersDown: false,
      }),
      CH1_PARTY_SELF_RECOVERY_MS
    );
  });

  it("stores and clears the native Elsewhen run marker", () => {
    const triggerState = TriggerState.create();
    writeCh1NativeRunAdmission(triggerState, {
      dungeonId: "ch1_dungeon_desert",
      runId: "run-one",
      partyId: "team:42",
    });
    assert.deepEqual(readCh1NativeRunAdmission(triggerState), {
      dungeonId: "ch1_dungeon_desert",
      runId: "run-one",
      partyId: "team:42",
    });
    assert.equal(
      ch1NativeRunAdmitsPosition(
        triggerState,
        ch1ElsewhenSlot("ch1_dungeon_desert")!.arrival
      ),
      true
    );
    assert.equal(
      ch1NativeRunAdmitsPosition(
        triggerState,
        ch1ElsewhenSlot("ch1_dungeon_winter")!.arrival
      ),
      false
    );
    clearCh1NativeRunAdmission(triggerState);
    assert.equal(readCh1NativeRunAdmission(triggerState), undefined);
  });

  it("accepts a sanitized diegetic name and preserves the profile separately", () => {
    const quest = CH1_QUESTS.find(
      (candidate) => candidate.id === "ch1_a1_q02_a_name_for_the_board"
    )!;
    const step = quest.steps.find(
      (candidate) => candidate.id === "choose_a_name"
    )!;
    const applied = ch1ApplyLiveObjectiveEffects({
      runtime: defaultCh1LiveGateRuntimeState(),
      quest,
      step,
      stepIndex: 0,
      choice: "name:  Rowan   Vale  ",
      nowMs: 10,
    });
    assert.equal(applied.runtime.chosenName, "Rowan Vale");
    assert.throws(() =>
      ch1ApplyLiveObjectiveEffects({
        runtime: defaultCh1LiveGateRuntimeState(),
        quest,
        step,
        stepIndex: 0,
        choice: "name:<script>",
        nowMs: 10,
      })
    );
  });

  it("makes unlocked latent skills reusable and rate-limited", () => {
    const runtime = defaultCh1LiveGateRuntimeState();
    runtime.flags.push(CH1_FLAGS.started);
    runtime.latentSkills.unlocked.push("ls_field_calibration");
    const first = ch1UseLiveLatentSkill(
      runtime,
      "ls_field_calibration",
      10_000
    );
    assert.equal(first.ok, true);
    assert.ok(
      first.ok &&
        first.runtime.ledger.entries.some(
          (entry) => entry.fragmentId === "frag_a3_overlay_the_balance"
        )
    );
    const immediate = ch1UseLiveLatentSkill(
      first.ok ? first.runtime : runtime,
      "ls_field_calibration",
      10_001
    );
    assert.equal(immediate.ok, false);
    const later = ch1UseLiveLatentSkill(
      first.ok ? first.runtime : runtime,
      "ls_field_calibration",
      15_001
    );
    assert.equal(later.ok, true);
  });
});
