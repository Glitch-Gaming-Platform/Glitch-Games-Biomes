import assert from "assert";
import { buildHarthmereLiveEntityProductionSeedChanges } from "@/server/harthmere/live_entity_ecs_seed";
import { HARTHMERE_NATIVE_BANDIT_SEEDS } from "@/shared/harthmere/bandit_production_seed";
import { HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS } from "@/shared/harthmere/business_customer_npc_seed";
import { harthmereNativeNpcCombatProfileForSeed } from "@/shared/harthmere/harthmere_native_combat";

describe("native Harthmere bandit ECS seeds", () => {
  it("materializes every authored bandit family as an Anima NPC", () => {
    assert.equal(HARTHMERE_NATIVE_BANDIT_SEEDS.length, 18);
    assert.equal(
      new Set(HARTHMERE_NATIVE_BANDIT_SEEDS.map((seed) => seed.entityId)).size,
      HARTHMERE_NATIVE_BANDIT_SEEDS.length
    );
    const businessCustomerIds = new Set(
      HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.map((seed) => seed.entityId)
    );
    assert.equal(
      HARTHMERE_NATIVE_BANDIT_SEEDS.filter((seed) =>
        businessCustomerIds.has(seed.entityId)
      ).length,
      0,
      "bandits must not reuse deterministic business-customer ECS ids"
    );
    assert.deepEqual(
      new Set(HARTHMERE_NATIVE_BANDIT_SEEDS.map((seed) => seed.banditRole)),
      new Set([
        "scout",
        "archer",
        "skirmisher",
        "brute",
        "captain",
        "prisoner",
      ])
    );
    for (const role of new Set(
      HARTHMERE_NATIVE_BANDIT_SEEDS.map((seed) => seed.banditRole)
    )) {
      const profiles = HARTHMERE_NATIVE_BANDIT_SEEDS.filter(
        (seed) => seed.banditRole === role
      ).map((seed) => ({
        combatLevel: seed.combatLevel,
        combatHp: seed.combatHp,
        attackDamage: seed.attackDamage,
        killXp: seed.killXp,
      }));
      assert.equal(
        new Set(profiles.map((profile) => JSON.stringify(profile))).size,
        1,
        `${role} entities must agree with their shared native NPC type`
      );
    }
    for (const required of [
      "Road Bandit Scout",
      "Wilds Bandit Ambusher",
      "Bandit Trapper",
      "Bandit Hedge Archer",
      "Outlaw Brute",
      "Former Guard Captain",
    ]) {
      assert.ok(
        HARTHMERE_NATIVE_BANDIT_SEEDS.some(
          (seed) => seed.displayName === required
        ),
        `missing ${required}`
      );
    }

    const changes = buildHarthmereLiveEntityProductionSeedChanges({
      tick: 7,
      nowSeconds: 1_700_000_000,
    });
    const byId = new Map(
      changes
        .filter((change) => change.kind !== "delete")
        .map((change) => [change.entity.id, change.entity])
    );
    for (const seed of HARTHMERE_NATIVE_BANDIT_SEEDS) {
      const entity = byId.get(seed.entityId);
      assert.ok(entity, `missing ECS entity ${seed.displayName}`);
      assert.ok(entity.npc_metadata, `${seed.displayName} needs npc_metadata`);
      assert.ok(entity.npc_state, `${seed.displayName} needs npc_state`);
      assert.ok(entity.position, `${seed.displayName} needs position`);
      assert.ok(entity.rigid_body, `${seed.displayName} needs rigid_body`);
      assert.ok(entity.health, `${seed.displayName} needs native health`);
      const profile = harthmereNativeNpcCombatProfileForSeed(seed);
      assert.equal(entity.npc_metadata.type_id, profile.id);
      assert.ok(profile.attackDamage > 0);
    }
  });

  it("keeps the captured prisoner ECS-owned but locked in the cage", () => {
    const prisoner = HARTHMERE_NATIVE_BANDIT_SEEDS.find(
      (seed) => seed.banditRole === "prisoner"
    );
    assert.ok(prisoner);
    const change = buildHarthmereLiveEntityProductionSeedChanges({
      tick: 1,
      nowSeconds: 1_700_000_000,
    }).find(
      (candidate) =>
        candidate.kind !== "delete" && candidate.entity.id === prisoner.entityId
    );
    assert.ok(change && change.kind !== "delete");
    assert.ok(change.entity.locked_in_place);
    const profile = harthmereNativeNpcCombatProfileForSeed(prisoner);
    assert.equal(profile.behaviorKind, "prisoner");
    assert.equal(profile.walkSpeed, 0);
    assert.equal(profile.aggroTrigger.kind, "onlyIfAttacked");
  });
});
