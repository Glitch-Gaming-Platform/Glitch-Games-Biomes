import assert from "assert";
import { materializeHarthmereNativeEcsPlans } from "@/server/harthmere/native_ecs_drop_materialization";
import { TriggerState } from "@/shared/ecs/gen/components";
import {
  readHarthmereNativeSkillTotalXp,
  writeHarthmereNativeSkillTotalXp,
} from "@/shared/harthmere/harthmere_skill_progression";

function fixture(actorId: number) {
  const triggerState = TriggerState.create();
  const receipts = new Map<string, string>();
  const player = {
    triggerState: () => triggerState,
    mutableTriggerState: () => triggerState,
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

describe("native skill progression materialization", () => {
  it("writes absolute totals once and treats an idempotency replay as complete", async () => {
    const actorId = 8290811499732991;
    const test = fixture(actorId);
    const plan = {
      kind: "skill_progress" as const,
      materializationKey: "skill-progress:test:one",
      actorId: String(actorId),
      skillXp: { farming: 25, nature_magic: 8 },
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
      readHarthmereNativeSkillTotalXp(test.triggerState, "farming"),
      25
    );
    assert.equal(
      readHarthmereNativeSkillTotalXp(test.triggerState, "nature_magic"),
      8
    );

    const replay = await materializeHarthmereNativeEcsPlans({
      redisPrimary: test.redisPrimary,
      worldApi: test.worldApi,
      idGenerator: {} as any,
      plans: [plan],
    });
    assert.deepEqual(replay, { created: 0, alreadyMaterialized: 1 });
  });

  it("never reduces a newer native total when an older plan is repaired", async () => {
    const actorId = 8290811499732992;
    const test = fixture(actorId);
    writeHarthmereNativeSkillTotalXp(test.triggerState, "crafting", 100);
    const result = await materializeHarthmereNativeEcsPlans({
      redisPrimary: test.redisPrimary,
      worldApi: test.worldApi,
      idGenerator: {} as any,
      plans: [
        {
          kind: "skill_progress",
          materializationKey: "skill-progress:test:stale",
          actorId: String(actorId),
          skillXp: { crafting: 40 },
          sourceKind: "test",
        },
      ],
    });
    assert.deepEqual(result, { created: 0, alreadyMaterialized: 1 });
    assert.equal(
      readHarthmereNativeSkillTotalXp(test.triggerState, "crafting"),
      100
    );
  });
});
