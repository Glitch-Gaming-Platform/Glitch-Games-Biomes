import assert from "assert";
import {
  readHarthmereLiveModeDailyStateForActor,
  resolveHarthmereLiveModeDailyStateActorId,
} from "../live_mode_daily_state";
import {
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModePlayerStateKey,
} from "@/shared/harthmere/live_mode_backend";
import { harthmereLiveModeInstallGameUserLinkKey } from "@/shared/harthmere/live_mode_actor_identity";

const ACTOR = "player_api_daily_001";
const NOW_MS = 1_700_200_000_000;

describe("live_mode_daily_state API route integration", () => {
  it("reads Redis state and returns today's claimed activities", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    const day = Math.floor(NOW_MS / (24 * 60 * 60 * 1000));
    backend.careLoops.daily.streak = 3;
    backend.careLoops.daily.claimed[`${day}:check_in`] = NOW_MS - 500;
    backend.careLoops.daily.completed[`${day}:jobs_board`] = NOW_MS - 300;
    const calls: string[] = [];
    const redis = {
      primary: {
        get: async (key: string) => {
          calls.push(key);
          return JSON.stringify(backend);
        },
      },
    };

    const snapshot = await readHarthmereLiveModeDailyStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(calls, [harthmereLiveModePlayerStateKey(ACTOR)]);
    assert.equal(snapshot.actorId, ACTOR);
    assert.equal(snapshot.streak, 3);
    assert.ok(snapshot.claimedToday.check_in);
    assert.ok(snapshot.completedToday.jobs_board);
    assert.equal(snapshot.claimedToday.jobs_board, undefined);
  });

  it("returns default daily state when Redis has no actor state", async () => {
    const redis = { primary: { get: async () => null } };
    const snapshot = await readHarthmereLiveModeDailyStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.equal(snapshot.actorId, ACTOR);
    assert.equal(snapshot.streak, 0);
    assert.deepEqual(snapshot.claimedToday, {});
    assert.deepEqual(snapshot.completedToday, {});
    assert.ok(snapshot.projects.grove_food_satchel);
  });

  it("resolves the same install-scoped Cloud Save actor as other live-state readers", async () => {
    const installId = "25f687dd-9ebe-4c31-8810-719ddfafe66b";
    const gameActorId = "glitch:43af071c-9922-4e02-ba46-32ee2b7479a6";
    const redis = {
      primary: {
        get: async (key: string) =>
          key === harthmereLiveModeInstallGameUserLinkKey(installId)
            ? gameActorId
            : null,
      },
    };

    const actorId = await resolveHarthmereLiveModeDailyStateActorId({
      redis,
      auth: { userId: "7061875752626857" },
      unsafeRequest: {
        query: { install_id: installId },
        headers: { "x-glitch-install-id": installId },
      },
    });

    assert.equal(actorId, gameActorId);
  });
});
