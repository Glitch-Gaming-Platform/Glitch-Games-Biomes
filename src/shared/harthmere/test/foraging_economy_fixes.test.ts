import assert from "assert";
import {
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
  createHarthmereLiveModeSharedWorldState,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeSharedWorldState,
  HARTHMERE_WILD_SPAWN_RESPAWN_MS,
  HARTHMERE_GATHER_SEED_COOLDOWN_MS,
} from "../live_mode_backend";
import { harthmereLiveModeFarmingGrantIsAuthoritative } from "../harthmere_live_mode_farming_authority";
import type { HarthmereLiveModeAuthorityEnvelope } from "../live_mode_readiness";

const ACTOR = "player_forage_001";
const NOW = 1_700_700_000_000;

function farmEnv(
  payload: Record<string, unknown>,
  actorId = ACTOR
): HarthmereLiveModeAuthorityEnvelope {
  return {
    requestId: `forage_${Math.random()}`,
    idempotencyKey: `forage_idem_${Math.random()}`,
    actorId,
    actionKind: "request_farming_action",
    subsystem: "farming",
    source: "client_request",
    serverReceivedAtMs: NOW,
    serverTick: 1,
    actorEntityVersion: 1,
    zoneId: "the_grove",
    payload,
    clientClaims: {},
  };
}

describe("foraging economy fixes (F-A/F-B/F-C/F-D/F-E)", () => {
  // F-A: a foraged bush respawns after the 12h window instead of being
  // depleted forever.
  it("F-A: forage depletes then respawns after the respawn window", () => {
    const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
    const spawnId = "forage_bush_alpha";

    const first = reduceHarthmereLiveModeBackendState(
      state,
      farmEnv({ operation: "forage_food", spawnId, itemId: "wild_berries" }),
      NOW
    );
    assert.equal(first.summary.warnings.length, 0);
    assert.equal(first.state.inventory.items.wild_berries, 1);

    // Re-forage inside the respawn window: rejected as depleted.
    const second = reduceHarthmereLiveModeBackendState(
      first.state,
      farmEnv({ operation: "forage_food", spawnId, itemId: "wild_berries" }),
      NOW + 1_000
    );
    assert.ok(
      second.summary.warnings.some((w) => w.includes("forage_rejected")),
      `expected depletion rejection, got ${JSON.stringify(
        second.summary.warnings
      )}`
    );
    assert.equal(second.state.inventory.items.wild_berries, 1);

    // After the respawn window: the bush is harvestable again (the authored
    // 12h respawn is no longer dead code).
    const afterRespawn = reduceHarthmereLiveModeBackendState(
      second.state,
      farmEnv({ operation: "forage_food", spawnId, itemId: "wild_berries" }),
      NOW + HARTHMERE_WILD_SPAWN_RESPAWN_MS + 1
    );
    assert.equal(
      afterRespawn.summary.warnings.length,
      0,
      `expected respawn success, got ${JSON.stringify(
        afterRespawn.summary.warnings
      )}`
    );
    assert.equal(afterRespawn.state.inventory.items.wild_berries, 2);
  });

  // F-E: forage depletion is world-shared, not a per-account scratch-off.
  it("F-E: forage depletion projects into shared world state and blocks another player", () => {
    const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
    const spawnId = "forage_bush_shared";
    const foraged = reduceHarthmereLiveModeBackendState(
      state,
      farmEnv({ operation: "forage_food", spawnId, itemId: "wild_berries" }),
      NOW
    );
    assert.equal(foraged.summary.warnings.length, 0);

    // The claim is exposed in the shared world projection...
    const shared = createHarthmereLiveModeSharedWorldState(foraged.state, NOW);
    const sharedClaimKeys = Object.keys(shared.wildSpawnClaims);
    assert.ok(
      sharedClaimKeys.some((k) => k.includes(spawnId)),
      `expected shared wild-spawn claim for ${spawnId}, got ${JSON.stringify(
        sharedClaimKeys
      )}`
    );

    // ...and round-trips through serialization.
    const roundTripped = parseHarthmereLiveModeSharedWorldState(
      JSON.stringify(shared),
      NOW
    );
    assert.ok(roundTripped);
    assert.ok(
      Object.keys(roundTripped!.wildSpawnClaims).some((k) =>
        k.includes(spawnId)
      )
    );

    // A DIFFERENT player who merges the shared world state sees the bush as
    // already depleted.
    const otherPlayer = defaultHarthmereLiveModeBackendState(
      "player_forage_002",
      NOW
    );
    mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      otherPlayer,
      roundTripped,
      NOW
    );
    const otherForage = reduceHarthmereLiveModeBackendState(
      otherPlayer,
      farmEnv(
        { operation: "forage_food", spawnId, itemId: "wild_berries" },
        "player_forage_002"
      ),
      NOW + 1_000
    );
    assert.ok(
      otherForage.summary.warnings.some((w) => w.includes("forage_rejected")),
      `expected shared depletion to block second player, got ${JSON.stringify(
        otherForage.summary.warnings
      )}`
    );
  });

  // F-C: gather_seed is rate-limited instead of infinite.
  it("F-C: gather_seed enforces a per-(source,seed) cooldown", () => {
    const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
    const first = reduceHarthmereLiveModeBackendState(
      state,
      farmEnv({
        operation: "gather_seed",
        seedItemId: "seed_wheat",
        source: "world",
      }),
      NOW
    );
    assert.equal(first.summary.warnings.length, 0);
    assert.equal(first.state.inventory.items.seed_wheat, 1);

    // Immediate re-gather is on cooldown.
    const second = reduceHarthmereLiveModeBackendState(
      first.state,
      farmEnv({
        operation: "gather_seed",
        seedItemId: "seed_wheat",
        source: "world",
      }),
      NOW + 1_000
    );
    assert.ok(
      second.summary.warnings.includes("farming_rejected:gather_on_cooldown"),
      `expected gather cooldown, got ${JSON.stringify(second.summary.warnings)}`
    );
    assert.equal(second.state.inventory.items.seed_wheat, 1);

    // After the cooldown elapses, gathering works again.
    const third = reduceHarthmereLiveModeBackendState(
      second.state,
      farmEnv({
        operation: "gather_seed",
        seedItemId: "seed_wheat",
        source: "world",
      }),
      NOW + HARTHMERE_GATHER_SEED_COOLDOWN_MS + 1
    );
    assert.equal(third.summary.warnings.length, 0);
    assert.equal(third.state.inventory.items.seed_wheat, 2);
  });

  it("allows forage rewards while overweight and still records depletion", () => {
    const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
    // Five heavy tools reach the soft encumbrance threshold; the forage reward
    // must still be collected because weight only changes stamina drain.
    state.inventory.items.harthmere_iron_longsword = 5;

    const result = reduceHarthmereLiveModeBackendState(
      state,
      farmEnv({
        operation: "forage_food",
        spawnId: "forage_bush_heavy",
        itemId: "wild_berries",
      }),
      NOW
    );
    assert.deepEqual(result.summary.warnings, []);
    assert.equal(result.state.inventory.items.wild_berries, 1);
    const duplicate = reduceHarthmereLiveModeBackendState(
      result.state,
      farmEnv({
        operation: "forage_food",
        spawnId: "forage_bush_heavy",
        itemId: "wild_berries",
      }),
      NOW + 1_000
    );
    assert.ok(
      duplicate.summary.warnings.includes("forage_rejected:spawn_depleted"),
      JSON.stringify(duplicate.summary.warnings)
    );
  });

  // F-B: the old deployment switch is retained only for compatibility and can
  // no longer move crop ownership out of native ECS.
  it("F-B: native ECS farming remains authoritative in every deployment", () => {
    assert.equal(harthmereLiveModeFarmingGrantIsAuthoritative({}), false);
    assert.equal(
      harthmereLiveModeFarmingGrantIsAuthoritative({ GLITCH_RUNTIME: "1" }),
      false
    );
    assert.equal(
      harthmereLiveModeFarmingGrantIsAuthoritative({
        GLITCH_RUNTIME: "1",
        HARTHMERE_LIVE_MODE_FARMING_AUTHORITATIVE: "0",
      }),
      false
    );
    assert.equal(
      harthmereLiveModeFarmingGrantIsAuthoritative({
        HARTHMERE_LIVE_MODE_FARMING_AUTHORITATIVE: "1",
      }),
      false
    );
  });
});
