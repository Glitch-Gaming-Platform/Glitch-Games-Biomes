/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import {
  HARTHMERE_EXOTIC_MATTER_CAVES,
  HARTHMERE_EXOTIC_MATTER_COMPONENTS,
  HARTHMERE_EXOTIC_MATTER_DEPOSITS,
  HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS,
  HARTHMERE_EXOTIC_MATTER_MATERIAL_ITEM_IDS,
  HARTHMERE_EXOTIC_MATTER_POWER_MW_PER_UNIT,
  HARTHMERE_LIGHT_EXOTIC_MATTER_CAVE_ANCHOR,
  HARTHMERE_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR,
  HARTHMERE_USER_CONFIRMED_FAR_HOLLOW_EXOTIC_MATTER_CAVE_ANCHOR,
  HARTHMERE_USER_CONFIRMED_HIGH_VAULT_EXOTIC_MATTER_CAVE_ANCHOR,
  HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR,
  HARTHMERE_USER_CONFIRMED_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR,
  defaultHarthmereExoticMatterDepositState,
  harthmereExoticMatterAcceptedJobDepositMarkers,
  harthmereExoticMatterCaveById,
  harthmereExoticMatterComponentForItemId,
  harthmereExoticMatterDepositAtBlock,
  harthmereExoticMatterDepositQuestMarkers,
  harthmereExoticMatterDepositRuntimePosition,
  harthmereExoticMatterDepositsForCave,
  harthmereExoticMatterJobEligibleDeposits,
  isHarthmereExoticMatterMaterialItemId,
  mineHarthmereExoticMatterDeposit,
  replenishHarthmereExoticMatterDeposits,
} from "../exotic_matter_caves";
import { HARTHMERE_EXOTIC_MATTER_ITEM_IDS } from "../mmo_crafting_catalogue";

const NOW = 1_800_000_000_000;

describe("Harthmere Exotic Matter cave deposits current", () => {
  it("uses the lore materials and existing crafting item ids", () => {
    assert.equal(HARTHMERE_EXOTIC_MATTER_POWER_MW_PER_UNIT, 100_400);
    assert.deepEqual(
      HARTHMERE_EXOTIC_MATTER_MATERIAL_ITEM_IDS.sort(),
      [
        HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antiboronBlock,
        HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antiheliumBlock,
        HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antihydrogenBlock,
      ].sort()
    );
    assert.equal(
      harthmereExoticMatterComponentForItemId("antihydrogen_block"),
      "antihydrogen"
    );
    assert.equal(isHarthmereExoticMatterMaterialItemId("coal"), false);

    for (const component of Object.values(HARTHMERE_EXOTIC_MATTER_COMPONENTS)) {
      assert.ok(component.displayName.includes("Block"));
      assert.ok(!component.displayName.includes("_"));
      assert.ok(component.lore.length > 20);
    }
  });

  it("places many deposits inside confirmed cave bounds without duplicate exact positions", () => {
    assert.ok(HARTHMERE_EXOTIC_MATTER_DEPOSITS.length >= 346);
    const positions = new Set<string>();

    for (const cave of HARTHMERE_EXOTIC_MATTER_CAVES) {
      assert.equal(cave.confirmedCave, true);
      assert.ok(cave.terrainEvidence.toLowerCase().includes("terrain"));
      const deposits = harthmereExoticMatterDepositsForCave(cave.caveId);
      const minimumDeposits =
        cave.caveId === "windowlight_little_cave"
          ? 4
          : cave.caveId === "deep_spindle_massive_cave"
            ? 24
            : cave.caveId === "harthmere_core_massive_cave"
              ? 81
              : cave.caveId === "harthmere_far_hollow_massive_cave"
                ? 81
                : cave.caveId === "harthmere_high_vault_massive_cave"
                  ? 81
                  : 5;
      assert.ok(
        deposits.length >= minimumDeposits,
        `${cave.caveId} should have a visible spread of materials`
      );
      for (const deposit of deposits) {
        const [x, y, z] = deposit.position;
        assert.ok(x > cave.bounds.x0 && x < cave.bounds.x1, deposit.depositId);
        assert.ok(
          y >= cave.bounds.y0 && y <= cave.bounds.y1,
          deposit.depositId
        );
        assert.ok(z > cave.bounds.z0 && z < cave.bounds.z1, deposit.depositId);
        const key = deposit.position.join(",");
        assert.equal(positions.has(key), false, `duplicate deposit ${key}`);
        positions.add(key);
      }
    }
  });

  it("keeps the light cave material-only and loads the massive cave with job-ready deposits", () => {
    const lightCave = harthmereExoticMatterCaveById("windowlight_little_cave");
    assert.ok(lightCave);
    assert.deepEqual(
      lightCave!.entrancePosition,
      HARTHMERE_LIGHT_EXOTIC_MATTER_CAVE_ANCHOR
    );
    const lightDeposits = harthmereExoticMatterDepositsForCave(
      "windowlight_little_cave"
    );
    assert.equal(lightDeposits.length, 4);
    assert.equal(
      lightDeposits.every((deposit) => !deposit.jobEligible),
      true
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlock({
        x: HARTHMERE_LIGHT_EXOTIC_MATTER_CAVE_ANCHOR[0],
        y: HARTHMERE_LIGHT_EXOTIC_MATTER_CAVE_ANCHOR[1],
        z: HARTHMERE_LIGHT_EXOTIC_MATTER_CAVE_ANCHOR[2],
      })?.depositId,
      "exotic_antihydrogen_windowlight_02"
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlock({
        x: 609 - 512,
        y: 33,
        z: -480,
      })?.depositId,
      "exotic_antihydrogen_windowlight_02"
    );

    const massiveCave = harthmereExoticMatterCaveById(
      "deep_spindle_massive_cave"
    );
    assert.ok(massiveCave);
    assert.deepEqual(
      massiveCave!.entrancePosition,
      HARTHMERE_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR
    );
    const massiveDeposits = harthmereExoticMatterDepositsForCave(
      "deep_spindle_massive_cave"
    );
    assert.equal(massiveDeposits.length, 33);
    assert.equal(
      massiveDeposits.every((deposit) => deposit.jobEligible),
      true
    );
    assert.deepEqual(
      new Set(massiveDeposits.map((deposit) => deposit.componentId)),
      new Set(["antihydrogen", "antihelium", "antiboron"])
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlock({
        x: HARTHMERE_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR[0],
        y: HARTHMERE_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR[1],
        z: HARTHMERE_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR[2],
      })?.depositId,
      "exotic_antihelium_deep_spindle_15"
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlock({
        x: 722 - 512,
        y: -32,
        z: -369,
      })?.depositId,
      "exotic_antihelium_deep_spindle_15"
    );
  });

  it("adds a dense material cluster around the user-confirmed cave coordinate", () => {
    const cave = harthmereExoticMatterCaveById("mossglass_survey_cave");
    assert.ok(cave);
    assert.deepEqual(
      cave!.entrancePosition,
      HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR
    );
    assert.ok(
      HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR[0] > cave!.bounds.x0 &&
        HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR[0] < cave!.bounds.x1
    );
    assert.ok(
      HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR[2] > cave!.bounds.z0 &&
        HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR[2] < cave!.bounds.z1
    );

    const deposits = harthmereExoticMatterDepositsForCave(
      "mossglass_survey_cave"
    );
    assert.equal(deposits.length, 9);
    assert.deepEqual(
      new Set(deposits.map((deposit) => deposit.componentId)),
      new Set(["antihydrogen", "antihelium", "antiboron"])
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlock({
        x: HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR[0],
        y: HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR[1],
        z: HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR[2],
      })?.depositId,
      "exotic_antihelium_mossglass_survey_05"
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlock({
        x: 690 - 512,
        y: 46,
        z: -90,
      })?.depositId,
      "exotic_antihelium_mossglass_survey_05"
    );
  });

  it("loads the user-confirmed massive cave coordinate with a lot of mineable deposits", () => {
    const cave = harthmereExoticMatterCaveById("harthmere_core_massive_cave");
    assert.ok(cave);
    assert.deepEqual(
      cave!.entrancePosition,
      HARTHMERE_USER_CONFIRMED_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR
    );

    const deposits = harthmereExoticMatterDepositsForCave(
      "harthmere_core_massive_cave"
    );
    assert.equal(deposits.length, 90);
    assert.equal(
      deposits.every((deposit) => deposit.jobEligible),
      true
    );
    assert.deepEqual(
      Object.fromEntries(
        ["antihydrogen", "antihelium", "antiboron"].map((componentId) => [
          componentId,
          deposits.filter((deposit) => deposit.componentId === componentId)
            .length,
        ])
      ),
      { antihydrogen: 30, antihelium: 30, antiboron: 30 }
    );

    assert.equal(
      harthmereExoticMatterDepositAtBlock({
        x: HARTHMERE_USER_CONFIRMED_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR[0],
        y: HARTHMERE_USER_CONFIRMED_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR[1],
        z: HARTHMERE_USER_CONFIRMED_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR[2],
      })?.depositId,
      "exotic_antihydrogen_harthmere_core_41"
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlock({
        x: 940 - 512,
        y: -1,
        z: -299,
      })?.depositId,
      "exotic_antihydrogen_harthmere_core_41"
    );
  });

  it("loads the second user-confirmed massive cave coordinate with a lot of mineable deposits", () => {
    const cave = harthmereExoticMatterCaveById(
      "harthmere_far_hollow_massive_cave"
    );
    assert.ok(cave);
    assert.deepEqual(
      cave!.entrancePosition,
      HARTHMERE_USER_CONFIRMED_FAR_HOLLOW_EXOTIC_MATTER_CAVE_ANCHOR
    );

    const deposits = harthmereExoticMatterDepositsForCave(
      "harthmere_far_hollow_massive_cave"
    );
    assert.equal(deposits.length, 90);
    assert.equal(
      deposits.every((deposit) => deposit.jobEligible),
      true
    );
    assert.deepEqual(
      Object.fromEntries(
        ["antihydrogen", "antihelium", "antiboron"].map((componentId) => [
          componentId,
          deposits.filter((deposit) => deposit.componentId === componentId)
            .length,
        ])
      ),
      { antihydrogen: 30, antihelium: 30, antiboron: 30 }
    );

    assert.equal(
      harthmereExoticMatterDepositAtBlock({
        x: HARTHMERE_USER_CONFIRMED_FAR_HOLLOW_EXOTIC_MATTER_CAVE_ANCHOR[0],
        y: HARTHMERE_USER_CONFIRMED_FAR_HOLLOW_EXOTIC_MATTER_CAVE_ANCHOR[1],
        z: HARTHMERE_USER_CONFIRMED_FAR_HOLLOW_EXOTIC_MATTER_CAVE_ANCHOR[2],
      })?.depositId,
      "exotic_antihydrogen_harthmere_far_hollow_41"
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlock({
        x: 972 - 512,
        y: 13,
        z: -674,
      })?.depositId,
      "exotic_antihydrogen_harthmere_far_hollow_41"
    );
  });

  it("loads the high user-confirmed massive cave coordinate with a lot of mineable deposits", () => {
    const cave = harthmereExoticMatterCaveById(
      "harthmere_high_vault_massive_cave"
    );
    assert.ok(cave);
    assert.deepEqual(
      cave!.entrancePosition,
      HARTHMERE_USER_CONFIRMED_HIGH_VAULT_EXOTIC_MATTER_CAVE_ANCHOR
    );

    const deposits = harthmereExoticMatterDepositsForCave(
      "harthmere_high_vault_massive_cave"
    );
    assert.equal(deposits.length, 90);
    assert.equal(
      deposits.every((deposit) => deposit.jobEligible),
      true
    );
    assert.deepEqual(
      Object.fromEntries(
        ["antihydrogen", "antihelium", "antiboron"].map((componentId) => [
          componentId,
          deposits.filter((deposit) => deposit.componentId === componentId)
            .length,
        ])
      ),
      { antihydrogen: 30, antihelium: 30, antiboron: 30 }
    );

    assert.equal(
      harthmereExoticMatterDepositAtBlock({
        x: HARTHMERE_USER_CONFIRMED_HIGH_VAULT_EXOTIC_MATTER_CAVE_ANCHOR[0],
        y: HARTHMERE_USER_CONFIRMED_HIGH_VAULT_EXOTIC_MATTER_CAVE_ANCHOR[1],
        z: HARTHMERE_USER_CONFIRMED_HIGH_VAULT_EXOTIC_MATTER_CAVE_ANCHOR[2],
      })?.depositId,
      "exotic_antihydrogen_harthmere_high_vault_41"
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlock({
        x: 194 - 512,
        y: 102,
        z: 309,
      })?.depositId,
      "exotic_antihydrogen_harthmere_high_vault_41"
    );
  });

  it("exposes player-facing quest markers and resolves block clusters", () => {
    const markers = harthmereExoticMatterDepositQuestMarkers();
    assert.equal(markers.length, HARTHMERE_EXOTIC_MATTER_DEPOSITS.length);
    for (const marker of markers) {
      assert.ok(!marker.label.includes("_"), marker.markerId);
      assert.equal(marker.markerId, marker.depositId);
    }

    const sample = HARTHMERE_EXOTIC_MATTER_DEPOSITS[0];
    assert.equal(
      harthmereExoticMatterDepositAtBlock({
        x: sample.position[0],
        y: sample.position[1],
        z: sample.position[2],
      })?.depositId,
      sample.depositId
    );
    assert.equal(
      harthmereExoticMatterDepositAtBlock({ x: 999, y: 10, z: 999 }),
      undefined
    );
  });

  it("shifts only additive-town cave markers and keeps original caverns underground", () => {
    const oldWell = HARTHMERE_EXOTIC_MATTER_DEPOSITS.find(
      (deposit) => deposit.depositId === "exotic_antihydrogen_old_well_01"
    )!;
    assert.deepEqual(
      harthmereExoticMatterDepositRuntimePosition(oldWell),
      [1996, 48, -240]
    );

    const deepSpindle = HARTHMERE_EXOTIC_MATTER_DEPOSITS.find(
      (deposit) => deposit.depositId === "exotic_antihydrogen_deep_spindle_01"
    )!;
    assert.deepEqual(
      harthmereExoticMatterDepositRuntimePosition(deepSpindle),
      deepSpindle.position
    );
    assert.ok(
      harthmereExoticMatterDepositRuntimePosition(deepSpindle)[1] < 0,
      "the original-map cavern marker must remain underground"
    );

    const markers = harthmereExoticMatterDepositQuestMarkers();
    assert.deepEqual(
      markers.find((marker) => marker.depositId === oldWell.depositId)
        ?.position,
      [1996, 48, -240]
    );
    assert.deepEqual(
      markers.find((marker) => marker.depositId === deepSpindle.depositId)
        ?.position,
      deepSpindle.position
    );
  });

  it("mines once, blocks immediate repeats, and replenishes exactly when due", () => {
    const deposit = HARTHMERE_EXOTIC_MATTER_DEPOSITS.find(
      (entry) => entry.componentId === "antihelium"
    )!;
    let state = defaultHarthmereExoticMatterDepositState();

    const mined = mineHarthmereExoticMatterDeposit({
      state,
      depositId: deposit.depositId,
      nowMs: NOW,
    });
    assert.deepEqual(mined.warnings, []);
    assert.deepEqual(mined.inventoryItemDeltas, {
      [HARTHMERE_EXOTIC_MATTER_COMPONENTS.antihelium.itemId]: 1,
    });
    assert.equal(mined.deposits[deposit.depositId].available, false);
    assert.equal(
      mined.deposits[deposit.depositId].replenishesAtMs,
      NOW + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS
    );

    const early = mineHarthmereExoticMatterDeposit({
      state: mined.deposits,
      depositId: deposit.depositId,
      nowMs: NOW + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS - 1,
    });
    assert.ok(
      early.warnings.includes("exotic_matter_rejected:deposit_replenishing")
    );
    assert.deepEqual(early.inventoryItemDeltas, {});

    state = replenishHarthmereExoticMatterDeposits({
      state: mined.deposits,
      nowMs: NOW + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS,
    });
    assert.equal(state[deposit.depositId].available, true);

    const minedAgain = mineHarthmereExoticMatterDeposit({
      state,
      depositId: deposit.depositId,
      nowMs: NOW + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS,
    });
    assert.deepEqual(minedAgain.warnings, []);
  });

  it("rejects unknown deposits without losing saved availability", () => {
    const state = defaultHarthmereExoticMatterDepositState();
    const knownId = HARTHMERE_EXOTIC_MATTER_DEPOSITS[0].depositId;
    state[knownId].available = false;

    const result = mineHarthmereExoticMatterDeposit({
      state,
      depositId: "missing_deposit",
      nowMs: NOW,
    });
    assert.ok(
      result.warnings.includes("exotic_matter_rejected:unknown_deposit")
    );
    assert.equal(result.deposits[knownId].available, false);
  });

  it("chooses deterministic accepted-job deposit markers for the requested material", () => {
    const first = harthmereExoticMatterAcceptedJobDepositMarkers({
      jobId: "job_1",
      todoId: "todo_1",
      itemId: "antiboron_block",
      count: 4,
    });
    const second = harthmereExoticMatterAcceptedJobDepositMarkers({
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

    const clamped = harthmereExoticMatterAcceptedJobDepositMarkers({
      jobId: "job_1",
      todoId: "todo_1",
      itemId: "antiboron_block",
      count: 999,
    });
    assert.equal(
      clamped.length,
      harthmereExoticMatterJobEligibleDeposits().filter(
        (deposit) => deposit.componentId === "antiboron"
      ).length
    );
  });

  it("keeps accepted-job fresh deposits in the target cave when possible", () => {
    const mossglass = harthmereExoticMatterAcceptedJobDepositMarkers({
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

    const deep = harthmereExoticMatterAcceptedJobDepositMarkers({
      jobId: "job_deep",
      todoId: "todo_deep",
      itemId: "antihydrogen_block",
      targetCaveId: "deep_spindle_massive_cave",
      count: 99,
    });
    assert.equal(deep.length, 11);
    assert.equal(
      deep.every((marker) => marker.caveId === "deep_spindle_massive_cave"),
      true
    );
  });

  it("falls back to job-eligible caves when a target cave has no eligible deposits", () => {
    const markers = harthmereExoticMatterAcceptedJobDepositMarkers({
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
