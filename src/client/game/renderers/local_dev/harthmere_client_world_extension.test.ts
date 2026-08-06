import {
  shouldEnableHarthmereClientWorldExtension,
  shouldPreserveHarthmereUnderwaysRuntimeScenery,
  shouldRenderHarthmereClientRuntimeTown,
  shouldUseHarthmereClientSnapshotBuiltRuntimePolicy,
} from "@/client/game/renderers/local_dev/harthmere_client_world_extension";
import assert from "assert";

describe("Harthmere client world-extension build flags", () => {
  it("keeps the additive offset by default", () => {
    assert.equal(shouldEnableHarthmereClientWorldExtension({}), true);
  });

  it("honors the public disable and standalone flags compiled by Next", () => {
    assert.equal(
      shouldEnableHarthmereClientWorldExtension({
        NEXT_PUBLIC_BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET: "1",
      }),
      false
    );
    assert.equal(
      shouldEnableHarthmereClientWorldExtension({
        NEXT_PUBLIC_BIOMES_HARTHMERE_STANDALONE_TOWN: "1",
      }),
      false
    );
  });

  it("keeps snapshot filtering when unshifted runtime is explicitly enabled", () => {
    const env = {
      NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE: "1",
      NEXT_PUBLIC_BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET: "1",
      NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN: "1",
    };
    assert.equal(shouldRenderHarthmereClientRuntimeTown(env), true);
    assert.equal(
      shouldUseHarthmereClientSnapshotBuiltRuntimePolicy(env),
      true,
      "ordinary unshifted town props must not float above snapshot terrain"
    );
  });

  it("preserves only the authored Bellward/Underways runtime district", () => {
    assert.equal(
      shouldPreserveHarthmereUnderwaysRuntimeScenery("Old Well / Underways"),
      true
    );
    assert.equal(
      shouldPreserveHarthmereUnderwaysRuntimeScenery("West Muck Breach"),
      false
    );
    assert.equal(shouldPreserveHarthmereUnderwaysRuntimeScenery(undefined), false);
  });

  it("keeps snapshot-built filtering for the ordinary shifted extension", () => {
    const env = {
      NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE: "1",
      NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN: "1",
    };
    assert.equal(shouldRenderHarthmereClientRuntimeTown(env), true);
    assert.equal(shouldUseHarthmereClientSnapshotBuiltRuntimePolicy(env), true);
  });
});
