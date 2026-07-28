#!/usr/bin/env node
"use strict";

/**
 * Move an existing local visual-test player to one focused Get the Muck Out
 * objective without replaying Road Ahead or Busted.
 *
 * This is an inner-loop browser fixture, not a quest-completion shortcut. It
 * only marks the authored predecessor leaves as fired; the objective under
 * test remains incomplete and must still advance through normal gameplay or
 * the production E2E bridge.
 *
 * Usage:
 *   GLITCH_REDIS_PORT=6390 \
 *     node scripts/harthmere/seed-get-muck-out-browser-step.cjs \
 *       <player-id> craft
 *
 *   GLITCH_REDIS_PORT=6390 \
 *     node scripts/harthmere/seed-get-muck-out-browser-step.cjs \
 *       <player-id> mucklings
 */

process.env.IS_SERVER ??= "true";
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const { scriptInit } = require("../../src/server/shared/script_init");
const {
  connectToRedisWithLua,
} = require("../../src/server/shared/redis/connection");
const { RedisWorld } = require("../../src/server/shared/world/redis");
const {
  Challenges,
  Position,
  TriggerState,
} = require("../../src/shared/ecs/gen/components");
const { secondsSinceEpoch } = require("../../src/shared/ecs/config");
const {
  NATIVE_BUSTED_QUEST_ID,
  NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION,
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_MUCK_VS_MACHINE_QUEST_ID,
  NATIVE_ROAD_AHEAD_QUEST_ID,
} = require("../../src/shared/harthmere/native_road_ahead_contract");

const CRAFT_WOODEN_WHACKER_STEP_ID = 2465592451503042;
const PRE_CRAFT_STEP_IDS = [7850203803086744, 1488451563795571];
const VALID_STEPS = new Set(["craft", "mucklings"]);

function parsePlayerId(raw) {
  const value = Number(raw);
  assert(
    Number.isSafeInteger(value) && value > 0,
    `Expected a positive safe-integer player id; received ${raw ?? "<missing>"}`
  );
  return value;
}

async function main() {
  const playerId = parsePlayerId(process.argv[2]);
  const targetStep = String(process.argv[3] ?? "").trim();
  assert(
    VALID_STEPS.has(targetStep),
    `Expected target step "craft" or "mucklings"; received ${
      targetStep || "<missing>"
    }`
  );

  await scriptInit();
  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  await world.waitForHealthy();
  try {
    const player = await world.get(playerId);
    assert(player, `Player ${playerId} does not exist`);

    const challenges = player.challenges()
      ? Challenges.clone(player.challenges())
      : Challenges.create();
    for (const questId of [
      NATIVE_ROAD_AHEAD_QUEST_ID,
      NATIVE_BUSTED_QUEST_ID,
      NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
      NATIVE_MUCK_VS_MACHINE_QUEST_ID,
    ]) {
      challenges.available.delete(questId);
      challenges.in_progress.delete(questId);
      challenges.complete.delete(questId);
      challenges.started_at.delete(questId);
      challenges.finished_at.delete(questId);
    }
    const now = secondsSinceEpoch();
    for (const questId of [NATIVE_ROAD_AHEAD_QUEST_ID, NATIVE_BUSTED_QUEST_ID]) {
      challenges.complete.add(questId);
      challenges.started_at.set(questId, now - 30);
      challenges.finished_at.set(questId, now - 20);
    }
    challenges.in_progress.add(NATIVE_GET_THE_MUCK_OUT_QUEST_ID);
    challenges.started_at.set(NATIVE_GET_THE_MUCK_OUT_QUEST_ID, now - 10);

    const triggerState = player.triggerState()
      ? TriggerState.clone(player.triggerState())
      : TriggerState.create();
    const firedStepIds =
      targetStep === "mucklings"
        ? [...PRE_CRAFT_STEP_IDS, CRAFT_WOODEN_WHACKER_STEP_ID]
        : PRE_CRAFT_STEP_IDS;
    triggerState.by_root.set(
      NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
      new Map(
        firedStepIds.map((stepId, index) => [
          stepId,
          now - firedStepIds.length + index,
        ])
      )
    );

    // Put the focused actor beside the actual production Muckling cluster. It
    // keeps the map marker, world beacon, synchronized NPC visibility and kill
    // test in one browser load instead of paying for another cross-map warp.
    const position = Position.create({
      v: [...NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION],
    });
    await world.apply({
      changes: [
        {
          kind: "update",
          entity: {
            id: playerId,
            challenges,
            trigger_state: triggerState,
            position,
          },
        },
      ],
    });
    const updated = await world.get(playerId);
    assert(
      updated?.challenges()?.in_progress.has(NATIVE_GET_THE_MUCK_OUT_QUEST_ID),
      "Focused fixture did not persist the active quest"
    );
    assert.deepEqual(
      [...(updated.triggerState()?.by_root.get(
        NATIVE_GET_THE_MUCK_OUT_QUEST_ID
      )?.keys() ?? [])],
      firedStepIds,
      "Focused fixture did not persist the predecessor leaves"
    );
    console.log(
      JSON.stringify({
        playerId: String(playerId),
        questId: String(NATIVE_GET_THE_MUCK_OUT_QUEST_ID),
        targetStep,
        firedStepIds: firedStepIds.map(String),
        position: position.v,
      })
    );
  } finally {
    await world.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
