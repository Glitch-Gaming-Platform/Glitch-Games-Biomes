import { runHarthmereNativeVitalsSchedulerTick } from "@/server/harthmere/native_vitals_scheduler";
import { ShimWorldApi } from "@/server/shared/world/shim/api";
import { InMemoryWorld } from "@/server/shared/world/shim/in_memory_world";
import { addGameUser, editEntity } from "@/server/test/test_helpers";
import {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { generateTestId } from "@/shared/test_helpers";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

describe("Harthmere native vitals scheduler", () => {
  it("ticks active players without relying on a mounted HUD", async () => {
    const world = new InMemoryWorld();
    const player = await addGameUser(world, generateTestId(), {});
    const worldApi = ShimWorldApi.createForWorld(world);
    const askApi = {
      scanAll: async () => [{ id: player.id }],
      scanForExport: async function* () {},
    } as any;
    const deriveUnderwater = async () => false;

    await runHarthmereNativeVitalsSchedulerTick({
      askApi,
      worldApi,
      voxeloo: {} as VoxelooModule,
      nowMs: 1_000,
      deriveUnderwater,
    });
    await runHarthmereNativeVitalsSchedulerTick({
      askApi,
      worldApi,
      voxeloo: {} as VoxelooModule,
      nowMs: 2_000,
      deriveUnderwater,
    });

    const vitals = readHarthmereNativeVitals(
      world.table.get(player.id)?.trigger_state
    );
    assert.ok(vitals.stamina < vitals.maxStamina);
    assert.equal(vitals.lastTickMs, 2_000);
  });

  it("derives drowning damage on the server and writes native Health", async () => {
    const world = new InMemoryWorld();
    const player = await addGameUser(world, generateTestId(), {});
    editEntity(world, player.id, (entity) => {
      writeHarthmereNativeVitals(entity.mutableTriggerState(), {
        breath: 0,
        lastTickMs: 1_000,
      });
    });
    const worldApi = ShimWorldApi.createForWorld(world);
    const askApi = {
      scanAll: async () => [{ id: player.id }],
      scanForExport: async function* () {},
    } as any;

    await runHarthmereNativeVitalsSchedulerTick({
      askApi,
      worldApi,
      voxeloo: {} as VoxelooModule,
      nowMs: 2_000,
      deriveUnderwater: async () => true,
    });

    const after = world.table.get(player.id)!;
    assert.equal(after.health?.hp, 95);
    assert.equal(after.health?.lastDamageSource?.kind, "drown");
    assert.equal(
      readHarthmereNativeVitals(after.trigger_state).underwater,
      true
    );
  });
});
