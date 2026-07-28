import assert from "assert";

import { materializeHarthmereNativeEcsPlans } from "@/server/harthmere/native_ecs_drop_materialization";
import { Health, Inventory, TriggerState } from "@/shared/ecs/gen/components";
import { readHarthmereNativeCombatProgression } from "@/shared/harthmere/harthmere_native_combat";

function fixture(actorId: number) {
  const triggerState = TriggerState.create();
  const health = Health.create({ hp: 100, maxHp: 100 });
  const inventory = Inventory.create();
  const receipts = new Map<string, string>();
  const player = {
    triggerState: () => triggerState,
    mutableTriggerState: () => triggerState,
    health: () => health,
    mutableHealth: () => health,
    inventory: () => inventory,
    mutableInventory: () => inventory,
  };
  const worldApi = {
    get: async (id: number) => (id === actorId ? player : undefined),
    edit: () => ({
      get: async (id: number) => (id === actorId ? player : undefined),
      commit: async () => undefined,
    }),
  } as any;
  const redisPrimary = {
    get: async (key: string) => receipts.get(key) ?? null,
    set: async (key: string, value: string) => {
      receipts.set(key, value);
    },
    del: async (key: string) => {
      receipts.delete(key);
    },
  };
  return { triggerState, worldApi, redisPrimary };
}

describe("native character progression materialization", () => {
  it("awards an authored character XP delta exactly once", async () => {
    const actorId = 8290811499733991;
    const test = fixture(actorId);
    const plan = {
      kind: "character_progress" as const,
      materializationKey: `snapshot_grove_reward:${actorId}:quest:xp`,
      actorId: String(actorId),
      xpDelta: 45,
      sourceKind: "test",
    };

    const first = await materializeHarthmereNativeEcsPlans({
      redisPrimary: test.redisPrimary,
      worldApi: test.worldApi,
      idGenerator: {} as any,
      plans: [plan],
    });
    assert.deepEqual(first, { created: 1, alreadyMaterialized: 0 });
    assert.equal(
      readHarthmereNativeCombatProgression(test.triggerState).xp,
      45
    );

    const replay = await materializeHarthmereNativeEcsPlans({
      redisPrimary: test.redisPrimary,
      worldApi: test.worldApi,
      idGenerator: {} as any,
      plans: [plan],
    });
    assert.deepEqual(replay, { created: 0, alreadyMaterialized: 1 });
    assert.equal(
      readHarthmereNativeCombatProgression(test.triggerState).xp,
      45
    );
  });
});
