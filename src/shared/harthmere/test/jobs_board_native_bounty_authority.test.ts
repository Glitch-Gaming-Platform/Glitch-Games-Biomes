import assert from "assert";
import { TriggerState } from "@/shared/ecs/gen/components";
import {
  HARTHMERE_JOBS_BOARD_KILL_LEDGER_MAX_ENTRIES,
  readHarthmereJobsBoardNativeKillLedger,
  recordHarthmereJobsBoardNativeKill,
} from "../jobs_board_native_kill_ledger";
import {
  HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS,
  harthmereJobsBoardMuckBountyTargetForId,
} from "../jobs_board_muck_bounty_targets";
import {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS,
  harthmereLiveEntitySizeForSeed,
} from "../live_entity_production_seed";
import { nativeJobsBoardObservedTargetIdsForTest } from "../live_mode_backend";
import {
  buildHarthmereLiveCreatureEntity,
  harthmereCreatureProgressionForSeed,
  harthmereLiveCreatureDisplayName,
} from "@/server/harthmere/live_entity_ecs_seed";
import { deserializeNpcCustomState } from "@/shared/npc/serde";

describe("native Jobs Board bounty authority", () => {
  it("binds every bounty to an exact ranked ECS seed", () => {
    for (const target of HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS) {
      const seed = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.find(
        (candidate) => candidate.entityId === target.entityId
      );
      assert.ok(seed, `${target.targetId} has no ECS seed`);
      assert.equal(seed!.bountyTier, target.monsterTier);
      assert.ok((seed!.progressionLevel ?? 0) >= 5);
      assert.equal(
        harthmereLiveCreatureDisplayName(seed!).startsWith(
          target.monsterTier === "boss" ? "Boss " : "Elite "
        ),
        true
      );
      const size = harthmereLiveEntitySizeForSeed(seed!);
      assert.ok(
        size[0] >= (target.monsterTier === "boss" ? 1.45 : 1.15),
        `${target.targetId} should be visibly larger than an ambient creature`
      );
    }
  });

  it("materializes bounty rank into Gaia ECS size/health and Anima state", () => {
    const ranked = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.find(
      (seed) => seed.bountyTier === "boss" && seed.combatKind === "mux"
    )!;
    const ambient = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.find(
      (seed) =>
        !seed.bountyTier &&
        seed.combatKind === ranked.combatKind &&
        seed.areaId === ranked.areaId
    )!;
    const rankedEntity = buildHarthmereLiveCreatureEntity(ranked, 123);
    const ambientEntity = buildHarthmereLiveCreatureEntity(ambient, 123);
    assert.ok(rankedEntity.health!.maxHp > ambientEntity.health!.maxHp);
    assert.ok(rankedEntity.size!.v[0] > ambientEntity.size!.v[0]);
    assert.equal(harthmereCreatureProgressionForSeed(ranked).level, 8);
    const animaState = deserializeNpcCustomState(rankedEntity.npc_state!.data);
    assert.equal(animaState.creatureProgression?.level, 8);
  });

  it("requires an exact post-accept native kill instead of marker proximity", () => {
    const target = HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS.find(
      (candidate) => !candidate.legacyTarget
    )!;
    assert.equal(
      harthmereJobsBoardMuckBountyTargetForId(target.targetId)?.entityId,
      target.entityId
    );
    const acceptedAtMs = 2_000;
    const job = {
      jobId: "job_exact_native_bounty",
      createdAtMs: 1_000,
      acceptedAtMs,
      mapMarkerId: target.markerId,
      targetId: target.targetId,
      requirements: [{ targetId: target.targetId }],
    } as any;
    const actorPosition = {
      x: target.position[0],
      y: target.position[1],
      z: target.position[2],
    };

    assert.deepEqual(
      nativeJobsBoardObservedTargetIdsForTest({ job, actorPosition }),
      [],
      "standing on the marker is not kill evidence"
    );
    assert.deepEqual(
      nativeJobsBoardObservedTargetIdsForTest({
        job,
        actorPosition,
        killedEntityAtMs: { [String(target.entityId)]: acceptedAtMs - 1 },
      }),
      [],
      "a kill before accepting the contract is stale"
    );
    assert.deepEqual(
      nativeJobsBoardObservedTargetIdsForTest({
        job,
        killedEntityAtMs: { [String(target.entityId)]: acceptedAtMs + 1 },
      }),
      [target.targetId]
    );
  });

  it("migrates already-accepted ordinary-seed bounty ids to ranked creatures", () => {
    const migrated = harthmereJobsBoardMuckBountyTargetForId(
      "muck_bounty_mucker_elite_ambient_muck_monster_old_wood_muck_patch_9512"
    );
    assert.ok(migrated);
    assert.equal(migrated!.monsterTier, "elite");
    assert.equal(migrated!.legacyTarget, true);
    const rankedSeed = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.find(
      (seed) => seed.entityId === migrated!.entityId
    );
    assert.equal(rankedSeed?.bountyTier, "elite");
  });

  it("stores a bounded native TriggerState kill ledger", () => {
    const state = TriggerState.create({ by_root: new Map() });
    for (let index = 0; index < 80; index += 1) {
      recordHarthmereJobsBoardNativeKill(
        state,
        (9_000_000_000_000_000 + index) as any,
        1_000 + index
      );
    }
    const ledger = readHarthmereJobsBoardNativeKillLedger(state);
    assert.equal(
      Object.keys(ledger).length,
      HARTHMERE_JOBS_BOARD_KILL_LEDGER_MAX_ENTRIES
    );
    assert.equal(ledger["9000000000000000"], undefined);
    assert.equal(ledger["9000000000000079"], 1_079);
  });
});
