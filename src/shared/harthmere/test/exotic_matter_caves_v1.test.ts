/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import {
  HARTHMERE_EXOTIC_MATTER_CAVES_V1,
  HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1,
  HARTHMERE_EXOTIC_MATTER_DEPOSITS_V1,
  HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS_V1,
  HARTHMERE_EXOTIC_MATTER_MATERIAL_ITEM_IDS_V1,
  HARTHMERE_EXOTIC_MATTER_POWER_MW_PER_UNIT_V1,
  HARTHMERE_LIGHT_EXOTIC_MATTER_CAVE_ANCHOR_V1,
  HARTHMERE_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR_V1,
  HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR_V1,
  defaultHarthmereExoticMatterDepositStateV1,
  harthmereExoticMatterAcceptedJobDepositMarkersV1,
  harthmereExoticMatterCaveByIdV1,
  harthmereExoticMatterComponentForItemIdV1,
  harthmereExoticMatterDepositAtBlockV1,
  harthmereExoticMatterDepositQuestMarkersV1,
  harthmereExoticMatterDepositsForCaveV1,
  harthmereExoticMatterJobEligibleDepositsV1,
  isHarthmereExoticMatterMaterialItemIdV1,
  mineHarthmereExoticMatterDepositV1,
  replenishHarthmereExoticMatterDepositsV1,
} from "../exotic_matter_caves_v1";
import { HARTHMERE_EXOTIC_MATTER_ITEM_IDS_V1 } from "../mmo_crafting_catalogue_v1";

const NOW = 1_800_000_000_000;

describe("Harthmere Exotic Matter cave deposits V1", () => {
  it("uses the lore materials and existing crafting item ids", () => {
    assert.equal(HARTHMERE_EXOTIC_MATTER_POWER_MW_PER_UNIT_V1, 100_400);
    assert.deepEqual(HARTHMERE_EXOTIC_MATTER_MATERIAL_ITEM_IDS_V1.sort(), [
      HARTHMERE_EXOTIC_MATTER_ITEM_IDS_V1.antiboronBlock,
      HARTHMERE_EXOTIC_MATTER_ITEM_IDS_V1.antiheliumBlock,
      HARTHMERE_EXOTIC_MATTER_ITEM_IDS_V1.antihydrogenBlock,
    ].sort());
    assert.equal(
      harthmereExoticMatterComponentForItemIdV1("antihydrogen_block"),
      "antihydrogen"
    );
    assert.equal(isHarthmereExoticMatterMaterialItemIdV1("coal"), false);

    for (const component of Object.values(HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1)) {
      assert.ok(component.displayName.includes("Block"));
      assert.ok(!component.displayName.includes("_"));
      assert.ok(component.lore.length > 20);
    }
  });

  it("places many deposits inside confirmed cave bounds without duplicate exact positions", () => {
    assert.ok(HARTHMERE_EXOTIC_MATTER_DEPOSITS_V1.length >= 67);
    const positions = new Set<string>();

    for (const cave of HARTHMERE_EXOTIC_MATTER_CAVES_V1) {
      assert.equal(cave.confirmedCave, true);
      assert.ok(cave.terrainEvidence.toLowerCase().includes("terrain"));
      const deposits = harthmereExoticMatterDepositsForCaveV1(cave.caveId);
      const minimumDeposits =
        cave.caveId === "windowlight_little_cave"
          ? 4
          : cave.caveId === "deep_spindle_massive_cave"
          ? 24
          : 5;
      assert.ok(
        deposits.length >= minimumDeposits,
        `${cave.caveId} should have a visible spread of materials`
      );
      for (const deposit of deposits) {
        const [x, y, z] = deposit.position;
        assert.ok(x > cave.bounds.x0 && x < cave.bounds.x1, deposit.depositId);
        assert.ok(y >= cave.bounds.y0 && y <= cave.bounds.y1, deposit.depositId);
        assert.ok(z > cave.bounds.z0 && z < cave.bounds.z1, deposit.depositId);
        const key = deposit.position.join(",");
        assert.equal(positions.has(key), false, `duplicate deposit ${key}`);
        positions.add(key);
      }
    }
  });

  it("keeps the light cave material-only and loads the massive cave with job-ready deposits", () => {
    const lightCave = harthmereExoticMatterCaveByIdV1(
      "windowlight_little_cave"
    );
    assert.ok(lightCave);
    assert.deepEqual(
      lightCave!.entrancePosition,
      HARTHMERE_LIGHT_EXOTIC_MATTER_CAVE_ANCHOR_V1
    );
    const lightDeposits = harthmereExoticMatterDepositsForCaveV1(
      "windowlight_little_cave"
    );
    assert.equal(lightDeposits.length, 4);
    assert.equal(lightDeposits.every((deposit) => !deposit.jobEligible), true);
    assert.equal(
      harthmereExoticMatterDepositAtBlockV1({
        x: HARTHMERE_LIGHT_EXOTIC_MATTER_CAVE_ANCHOR_V1[0],
        y: HARTHMERE_LIGHT_EXOTIC_MATTER_CAVE_ANCHOR_V1[1],
        z: HARTHMERE_LIGHT_EXOTIC_MATTER_CAVE_ANCHOR_V1[2],
      })?.depositId,
      "exotic_antihydrogen_windowlight_02"
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlockV1({
        x: 609 - 512,
        y: 33,
        z: -480,
      })?.depositId,
      "exotic_antihydrogen_windowlight_02"
    );

    const massiveCave = harthmereExoticMatterCaveByIdV1(
      "deep_spindle_massive_cave"
    );
    assert.ok(massiveCave);
    assert.deepEqual(
      massiveCave!.entrancePosition,
      HARTHMERE_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR_V1
    );
    const massiveDeposits = harthmereExoticMatterDepositsForCaveV1(
      "deep_spindle_massive_cave"
    );
    assert.equal(massiveDeposits.length, 24);
    assert.equal(massiveDeposits.every((deposit) => deposit.jobEligible), true);
    assert.deepEqual(
      new Set(massiveDeposits.map((deposit) => deposit.componentId)),
      new Set(["antihydrogen", "antihelium", "antiboron"])
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlockV1({
        x: HARTHMERE_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR_V1[0],
        y: HARTHMERE_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR_V1[1],
        z: HARTHMERE_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR_V1[2],
      })?.depositId,
      "exotic_antihelium_deep_spindle_15"
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlockV1({
        x: 722 - 512,
        y: -32,
        z: -369,
      })?.depositId,
      "exotic_antihelium_deep_spindle_15"
    );
  });

  it("adds a dense material cluster around the user-confirmed cave coordinate", () => {
    const cave = harthmereExoticMatterCaveByIdV1("mossglass_survey_cave");
    assert.ok(cave);
    assert.deepEqual(
      cave!.entrancePosition,
      HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR_V1
    );
    assert.ok(
      HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR_V1[0] >
        cave!.bounds.x0 &&
        HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR_V1[0] <
          cave!.bounds.x1
    );
    assert.ok(
      HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR_V1[2] >
        cave!.bounds.z0 &&
        HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR_V1[2] <
          cave!.bounds.z1
    );

    const deposits = harthmereExoticMatterDepositsForCaveV1(
      "mossglass_survey_cave"
    );
    assert.equal(deposits.length, 9);
    assert.deepEqual(
      new Set(deposits.map((deposit) => deposit.componentId)),
      new Set(["antihydrogen", "antihelium", "antiboron"])
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlockV1({
        x: HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR_V1[0],
        y: HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR_V1[1],
        z: HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR_V1[2],
      })?.depositId,
      "exotic_antihelium_mossglass_survey_05"
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlockV1({
        x: 690 - 512,
        y: 46,
        z: -90,
      })?.depositId,
      "exotic_antihelium_mossglass_survey_05"
    );
  });

  it("exposes player-facing quest markers and resolves block clusters", () => {
    const markers = harthmereExoticMatterDepositQuestMarkersV1();
    assert.equal(markers.length, HARTHMERE_EXOTIC_MATTER_DEPOSITS_V1.length);
    for (const marker of markers) {
      assert.ok(!marker.label.includes("_"), marker.markerId);
      assert.equal(marker.markerId, marker.depositId);
    }

    const sample = HARTHMERE_EXOTIC_MATTER_DEPOSITS_V1[0];
    assert.equal(
      harthmereExoticMatterDepositAtBlockV1({
        x: sample.position[0],
        y: sample.position[1],
        z: sample.position[2],
      })?.depositId,
      sample.depositId
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlockV1({ x: 999, y: 10, z: 999 }),
      undefined
    );
  });

  it("mines once, blocks immediate repeats, and replenishes exactly when due", () => {
    const deposit = HARTHMERE_EXOTIC_MATTER_DEPOSITS_V1.find(
      (entry) => entry.componentId === "antihelium"
    )!;
    let state = defaultHarthmereExoticMatterDepositStateV1();

    const mined = mineHarthmereExoticMatterDepositV1({
      state,
      depositId: deposit.depositId,
      nowMs: NOW,
    });
    assert.deepEqual(mined.warnings, []);
    assert.deepEqual(mined.inventoryItemDeltas, {
      [HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antihelium.itemId]: 1,
    });
    assert.equal(mined.deposits[deposit.depositId].available, false);
    assert.equal(
      mined.deposits[deposit.depositId].replenishesAtMs,
      NOW + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS_V1
    );

    const early = mineHarthmereExoticMatterDepositV1({
      state: mined.deposits,
      depositId: deposit.depositId,
      nowMs: NOW + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS_V1 - 1,
    });
    assert.ok(early.warnings.includes("exotic_matter_rejected:deposit_replenishing"));
    assert.deepEqual(early.inventoryItemDeltas, {});

    state = replenishHarthmereExoticMatterDepositsV1({
      state: mined.deposits,
      nowMs: NOW + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS_V1,
    });
    assert.equal(state[deposit.depositId].available, true);

    const minedAgain = mineHarthmereExoticMatterDepositV1({
      state,
      depositId: deposit.depositId,
      nowMs: NOW + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS_V1,
    });
    assert.deepEqual(minedAgain.warnings, []);
  });

  it("rejects unknown deposits without losing saved availability", () => {
    const state = defaultHarthmereExoticMatterDepositStateV1();
    const knownId = HARTHMERE_EXOTIC_MATTER_DEPOSITS_V1[0].depositId;
    state[knownId].available = false;

    const result = mineHarthmereExoticMatterDepositV1({
      state,
      depositId: "missing_deposit",
      nowMs: NOW,
    });
    assert.ok(result.warnings.includes("exotic_matter_rejected:unknown_deposit"));
    assert.equal(result.deposits[knownId].available, false);
  });

  it("chooses deterministic accepted-job deposit markers for the requested material", () => {
    const first = harthmereExoticMatterAcceptedJobDepositMarkersV1({
      jobId: "job_1",
      todoId: "todo_1",
      itemId: "antiboron_block",
      count: 4,
    });
    const second = harthmereExoticMatterAcceptedJobDepositMarkersV1({
      jobId: "job_1",
      todoId: "todo_1",
      itemId: "antiboron_block",
      count: 4,
    });
    assert.deepEqual(second, first);
    assert.equal(first.length, 4);
    assert.equal(new Set(first.map((marker) => marker.depositId)).size, 4);
    for (const marker of first) {
      assert.equal(marker.componentId, "antiboron");
      assert.notEqual(marker.caveId, "windowlight_little_cave");
      assert.ok(marker.label.startsWith("Fresh Antiboron"));
    }

    const clamped = harthmereExoticMatterAcceptedJobDepositMarkersV1({
      jobId: "job_1",
      todoId: "todo_1",
      itemId: "antiboron_block",
      count: 999,
    });
    assert.equal(
      clamped.length,
      harthmereExoticMatterJobEligibleDepositsV1().filter(
        (deposit) => deposit.componentId === "antiboron"
      ).length
    );
  });

  it("keeps accepted-job fresh deposits in the target cave when possible", () => {
    const mossglass = harthmereExoticMatterAcceptedJobDepositMarkersV1({
      jobId: "job_mossglass",
      todoId: "todo_mossglass",
      itemId: "antiboron_block",
      targetCaveId: "mossglass_survey_cave",
      count: 8,
    });
    assert.equal(mossglass.length, 3);
    assert.equal(
      mossglass.every((marker) => marker.caveId === "mossglass_survey_cave"),
      true
    );
    assert.equal(
      mossglass.every((marker) => marker.componentId === "antiboron"),
      true
    );

    const deep = harthmereExoticMatterAcceptedJobDepositMarkersV1({
      jobId: "job_deep",
      todoId: "todo_deep",
      itemId: "antihydrogen_block",
      targetCaveId: "deep_spindle_massive_cave",
      count: 99,
    });
    assert.equal(deep.length, 8);
    assert.equal(
      deep.every((marker) => marker.caveId === "deep_spindle_massive_cave"),
      true
    );
  });

  it("falls back to job-eligible caves when a target cave has no eligible deposits", () => {
    const markers = harthmereExoticMatterAcceptedJobDepositMarkersV1({
      jobId: "job_light_cave",
      todoId: "todo_light_cave",
      itemId: "antihelium_block",
      targetCaveId: "windowlight_little_cave",
      count: 4,
    });

    assert.equal(markers.length, 4);
    assert.equal(
      markers.some((marker) => marker.caveId === "windowlight_little_cave"),
      false
    );
    assert.equal(
      markers.every((marker) => marker.componentId === "antihelium"),
      true
    );
  });
});
