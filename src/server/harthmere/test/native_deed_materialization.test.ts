import { materializeHarthmereNativeEcsPlans } from "@/server/harthmere/native_ecs_drop_materialization";
import { ShimWorldApi } from "@/server/shared/world/shim/api";
import { InMemoryWorld } from "@/server/shared/world/shim/in_memory_world";
import type { HarthmereNativeEcsDeedMaterializationPlan } from "@/shared/harthmere/live_mode_backend";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

describe("Harthmere native deed materialization", () => {
  it("creates, transfers, and removes the native deed protection volume", async () => {
    const values = new Map<string, string>();
    const redisPrimary = {
      get: async (key: string) => values.get(key) ?? null,
      set: async (key: string, value: string, ...args: unknown[]) => {
        if (args.includes("NX") && values.has(key)) return null;
        values.set(key, value);
        return "OK";
      },
      del: async (key: string) => Number(values.delete(key)),
    };
    const world = new InMemoryWorld();
    const worldApi = ShimWorldApi.createForWorld(world);
    const deedId = 8_850_000_000_000_001 as BiomesId;
    const idGenerator = { next: async () => deedId } as any;
    const plan = (
      materializationKey: string,
      ownerActorId: string,
      operation: "upsert" | "delete" = "upsert"
    ): HarthmereNativeEcsDeedMaterializationPlan => ({
      kind: "deed",
      materializationKey,
      plotId: "grove_test_plot",
      operation,
      ownerActorId,
      displayName: "Grove Test Plot",
      description: "A protected test plot.",
      bounds: { xMin: 10, xMax: 14, zMin: 20, zMax: 25 },
      groundY: 50,
      maxStructureHeight: 12,
      allowedBuilderActorIds: ["333"],
      publicBuild: false,
      sourceKind: "test",
    });

    await materializeHarthmereNativeEcsPlans({
      redisPrimary,
      worldApi,
      idGenerator,
      plans: [plan("deed:create", "111")],
    });
    let deed = world.table.get(deedId)!;
    assert.equal(deed.deed_component?.owner, 111);
    assert.equal(deed.acl_component?.acl.creator?.[0], 111);
    assert.equal(deed.acl_component?.acl.entities.has(333 as BiomesId), true);
    assert.deepEqual(deed.box, { v0: [10, 50, 20], v1: [15, 62, 26] });
    assert.ok(deed.protection);

    await materializeHarthmereNativeEcsPlans({
      redisPrimary,
      worldApi,
      idGenerator,
      plans: [plan("deed:transfer", "222")],
    });
    deed = world.table.get(deedId)!;
    assert.equal(deed.deed_component?.owner, 222);
    assert.equal(deed.acl_component?.acl.creator?.[0], 222);

    await materializeHarthmereNativeEcsPlans({
      redisPrimary,
      worldApi,
      idGenerator,
      plans: [plan("deed:delete", "222", "delete")],
    });
    assert.equal(world.table.get(deedId), undefined);
  });
});
