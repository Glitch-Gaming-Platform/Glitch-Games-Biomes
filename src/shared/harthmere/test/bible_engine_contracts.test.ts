/// <reference types="mocha" />
/// <reference types="node" />
//
// BIBLE_ENGINE_CONTRACTS
//
// The ECS / Gaia / Anima rules, asserted over the authored catalog. Mirrors
// `ch1_engine_contracts.test.ts`.
//
// The waypoint-grounding case here is the highest-leverage assertion in the
// whole migration: it runs in about a second and covers a failure that costs
// three minutes per affected row in a browser (TESTING_FASTER 4.12), across
// 312 affected rows.

import assert from "assert";
import fs from "fs";
import path from "path";
import { BIBLE_QUEST_CATALOG } from "../bible/bible_quest_catalog";
import {
  BIBLE_AUTHORED_WAYPOINT_READERS,
  BIBLE_GAIA_UNTOUCHED,
  BIBLE_NATIVE_ECS_OWNED,
  BIBLE_NON_ECS_OWNED,
  bibleValidateEngineContracts,
  bibleValidateEveryStepIsAddressable,
  bibleValidateGiversAreNotCombatTargets,
  bibleValidateGiversResolve,
  bibleValidateNoEcsMovesAuthored,
  bibleValidateNoUnmodelledFailure,
  bibleValidateWaypointsAreGrounded,
  bibleQuestsMissingSteps,
} from "../bible/bible_engine_contracts";
import { HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST } from "../harthmere_native_quest_manifest";
import { defaultBibleLiveSlice } from "../bible/bible_live_slice";

const BIBLE_DIR = path.resolve(__dirname, "../bible");

describe("Bible engine contracts — native ECS", () => {
  it("makes every authored step addressable by the signed progress path", () => {
    assert.deepEqual(bibleValidateEveryStepIsAddressable(), []);
  });

  it("has no quest without objectives", () => {
    assert.deepEqual(
      bibleQuestsMissingSteps().map((quest) => quest.id),
      []
    );
  });

  it("keeps every objective server-authoritative and idempotent", () => {
    // Both are load-bearing: /sync reconnects cancel in-flight publishes, so a
    // non-idempotent step silently loses progress on a retry.
    for (const quest of BIBLE_QUEST_CATALOG) {
      for (const step of quest.steps) {
        assert.equal(
          step.validation.serverAuthority,
          true,
          `${quest.id}/${step.id}`
        );
        assert.equal(
          step.validation.idempotent,
          true,
          `${quest.id}/${step.id}`
        );
      }
    }
  });

  it("authors no quest failure while the failed state is unmodelled", () => {
    assert.deepEqual(bibleValidateNoUnmodelledFailure(), []);
  });

  it("keeps the residual non-ECS slice closed and small", () => {
    assert.equal(BIBLE_NON_ECS_OWNED.length, 6);
    // Every key of the live slice must be justified by an entry on the list.
    const sliceKeys = Object.keys(defaultBibleLiveSlice());
    assert.deepEqual(sliceKeys.sort(), [
      "choices",
      "flags",
      "lastCompletedAtMs",
      "reputation",
      "titles",
    ]);
    assert(BIBLE_NATIVE_ECS_OWNED.includes("objective step completion"));
    assert(
      !BIBLE_NON_ECS_OWNED.some((entry) => entry.includes("progress")),
      "progress must never re-enter the non-ECS slice"
    );
  });
});

describe("Bible engine contracts — Gaia", () => {
  it("declares that Bible quests do not simulate terrain", () => {
    assert.equal(BIBLE_GAIA_UNTOUCHED, true);
  });

  // 312 of 340 authored waypoints carry Y=0. Shipping one strands the player
  // under terrain and burns a three-minute browser movement timeout.
  it("grounds every shipped waypoint", () => {
    assert.deepEqual(bibleValidateWaypointsAreGrounded(), []);
  });

  it("reads authored Y in exactly one module", () => {
    const readers: string[] = [];
    for (const file of fs.readdirSync(BIBLE_DIR)) {
      if (!file.endsWith(".ts")) continue;
      if (file.startsWith("bible_quests_")) continue; // the data itself
      if (file === "bible_quest_schema.ts") continue; // declares the field
      const text = fs.readFileSync(path.join(BIBLE_DIR, file), "utf8");
      // Ignore comment lines: the rule is discussed in several headers.
      const code = text
        .split("\n")
        .filter(
          (line) =>
            !line.trim().startsWith("*") && !line.trim().startsWith("//")
        )
        .join("\n");
      if (code.includes("authoredWaypoint")) {
        readers.push(`src/shared/harthmere/bible/${file}`);
      }
    }
    assert.deepEqual(
      readers.sort(),
      [...BIBLE_AUTHORED_WAYPOINT_READERS].sort(),
      "authored Y=0 must only be resolved by bible_waypoints.ts"
    );
  });
});

describe("Bible engine contracts — Anima", () => {
  it("resolves every quest giver to a seeded entity", () => {
    // Resolution is by id through the manifest, never by matching a rendered
    // NPC's display label — a label gaining a role suffix silently orphans it.
    const errors = bibleValidateGiversResolve(
      (giverId) =>
        HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST[
          giverId as keyof typeof HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST
        ]
    );
    assert.deepEqual(errors, []);
  });

  it("never makes a quest giver a combat target", () => {
    assert.deepEqual(bibleValidateGiversAreNotCombatTargets(), []);
  });

  it("authors no ECS move anywhere in the catalog", () => {
    // Bible progress is per-player; the NPC set is shared. Moving a giver for
    // one player's story moves them for everyone and takes position authority
    // from Anima's brain and return-home anchor.
    assert.deepEqual(bibleValidateNoEcsMovesAuthored(), []);
  });
});

describe("Bible engine contracts — fast-suite discipline", () => {
  // If any of these leak in, the Bible suite starts needing the server
  // bootstrap it exists to avoid (TESTING_FASTER section 3).
  const FORBIDDEN_VALUE_IMPORTS = [
    "@/shared/bikkie/active",
    "@/shared/game/items",
    "@/server/",
    "@/client/",
    "@/shared/ecs/gen/",
  ];

  it("imports no server, client, ECS-gen or Bikkie-data module at value position", () => {
    const offenders: string[] = [];
    for (const file of fs.readdirSync(BIBLE_DIR)) {
      if (!file.endsWith(".ts")) continue;
      const text = fs.readFileSync(path.join(BIBLE_DIR, file), "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("import ")) continue;
        if (trimmed.startsWith("import type ")) continue; // erased at compile
        for (const forbidden of FORBIDDEN_VALUE_IMPORTS) {
          if (trimmed.includes(forbidden)) {
            offenders.push(`${file}: ${trimmed}`);
          }
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("runs the whole contract aggregate clean", () => {
    assert.deepEqual(bibleValidateEngineContracts(), []);
  });
});
