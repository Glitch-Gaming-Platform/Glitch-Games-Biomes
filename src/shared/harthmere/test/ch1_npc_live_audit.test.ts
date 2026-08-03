import assert from "assert";
import fs from "fs";
import path from "path";
import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import { ch1CastVisualForEntity } from "@/shared/harthmere/ch1_cast_visuals";
import { CH1_ANCHORS, CH1_FLAGS } from "@/shared/harthmere/ch1_ids";
import {
  CH1_NPC_LIVE_AUDIT_SCENARIOS,
  CH1_RETIRED_NPC_LIVE_AUDIT_ENTITY_IDS,
  CH1_SHARED_NPC_LIVE_AUDIT_ENTRIES,
  ch1NpcLiveAuditCatalog,
  ch1NpcLiveAuditStaging,
} from "@/shared/harthmere/ch1_npc_live_audit";
import { CH1_GROVE_SUPPLIER_ROUTE } from "@/shared/harthmere/ch1_objective_routes";
import { ch1ObjectiveTarget } from "@/shared/harthmere/ch1_objective_targets";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";
import {
  CH1_SERGEANT_HOLT,
  ch1ReturningNpcStageDirections,
} from "@/shared/harthmere/ch1_returning_npcs";
import { CH1_TESTIMONY_NPC_SEEDS } from "@/shared/harthmere/ch1_testimony_npcs";
import {
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveGroundedPosition,
} from "@/shared/harthmere/snapshot_grove_content";
import { SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS } from "@/shared/harthmere/snapshot_grove_ids";

describe("Chapter 1 NPC live acceptance matrix", () => {
  it("covers every canonical cast member and every authored absence family", () => {
    const ids = CH1_NPC_LIVE_AUDIT_SCENARIOS.map((scenario) => scenario.id);
    assert.equal(new Set(ids).size, ids.length);
    const mentioned = new Set(
      CH1_NPC_LIVE_AUDIT_SCENARIOS.flatMap((scenario) => [
        ...scenario.expectedPresentKeys,
        ...(scenario.expectedAbsentKeys ?? []),
      ])
    );
    for (const member of CH1_NEW_CAST) {
      assert.ok(mentioned.has(member.key), member.key);
    }
    for (const id of [
      "ending-contain-absence",
      "ending-ledger-surrendered",
      "ending-hallr-runs",
    ]) {
      assert.ok(ids.includes(id), id);
    }
  });

  it("covers each distinct Jackie location and the legacy Road Ahead home", () => {
    const expected = new Map<
      string,
      readonly [number, number, number] | undefined
    >([
      ["starter-jackie-road-ahead", undefined],
      ["act1-roadhouse", CH1_ANCHORS.roadhouse_jackie_post],
      ["act1-fence-walk", CH1_ANCHORS.broken_safe_zone_fence],
      ["act1-first-seam", CH1_ANCHORS.gate_fence_sighting],
      ["act2-the-flinch", CH1_ANCHORS.gate_desert_jackie_post],
      ["act4-statement", CH1_ANCHORS.grove_watch_house_jackie_post],
      ["act6-watch-house", CH1_ANCHORS.grove_watch_house_jackie_post],
      ["ending-confess-roadhouse", CH1_ANCHORS.roadhouse_jackie_post],
    ]);
    for (const [id, position] of expected) {
      const scenario = CH1_NPC_LIVE_AUDIT_SCENARIOS.find(
        (candidate) => candidate.id === id
      )!;
      const jackie = ch1NpcLiveAuditStaging(scenario.input).find(
        (row) => row.key === "jackie"
      )!;
      assert.equal(jackie.present, true, id);
      assert.deepEqual(jackie.position, position, id);
    }
    const contained = ch1NpcLiveAuditStaging(
      CH1_NPC_LIVE_AUDIT_SCENARIOS.find(
        (scenario) => scenario.id === "ending-contain-absence"
      )!.input
    ).find((row) => row.key === "jackie")!;
    assert.equal(contained.present, false);
  });

  it("keeps one canonical identity per actor while separating watch-house Talk posts", () => {
    for (const scenario of CH1_NPC_LIVE_AUDIT_SCENARIOS) {
      const staging = ch1NpcLiveAuditStaging(scenario.input);
      assert.equal(
        new Set(staging.map((row) => row.entityId)).size,
        staging.length,
        `${scenario.id} must not project one canonical NPC twice`
      );
    }

    const statement = ch1NpcLiveAuditStaging(
      CH1_NPC_LIVE_AUDIT_SCENARIOS.find(
        (scenario) => scenario.id === "act4-statement"
      )!.input
    );
    const position = (key: string) =>
      statement.find((row) => row.key === key)!.position!;
    assert.deepEqual(
      position("sergeant_bram_holt"),
      CH1_ANCHORS.grove_watch_house_holt_post
    );
    assert.deepEqual(
      position("teak_morrow"),
      CH1_ANCHORS.grove_watch_house_teak_post
    );
    assert.deepEqual(
      position("jackie"),
      CH1_ANCHORS.grove_watch_house_jackie_post
    );
    for (const [left, right] of [
      ["sergeant_bram_holt", "teak_morrow"],
      ["sergeant_bram_holt", "jackie"],
      ["teak_morrow", "jackie"],
    ] as const) {
      const a = position(left);
      const b = position(right);
      assert.ok(
        Math.hypot(a[0] - b[0], a[2] - b[2]) >= 4,
        `${left} and ${right} need distinct interaction zones`
      );
    }

    const statementTarget = ch1ObjectiveTarget(
      "ch1_a4_q07_ask_me_in_a_month",
      "report_or_not"
    )!;
    assert.equal(statementTarget.entityId, CH1_SERGEANT_HOLT.entityId);
    assert.deepEqual(
      statementTarget.position,
      CH1_ANCHORS.grove_watch_house_holt_post
    );
  });

  it("never stages two visible story actors at the same coordinates", () => {
    for (const scenario of CH1_NPC_LIVE_AUDIT_SCENARIOS) {
      const visible = ch1NpcLiveAuditStaging(scenario.input).filter(
        (row) => row.present && row.position
      );
      for (let left = 0; left < visible.length; left += 1) {
        for (let right = left + 1; right < visible.length; right += 1) {
          assert.notDeepEqual(
            visible[left].position,
            visible[right].position,
            `${scenario.id}: ${visible[left].key} and ${visible[right].key} share one visible body position`
          );
        }
      }
    }
  });

  it("separates Jackie and Rook at the Old Wood return aperture", () => {
    const scenario = CH1_NPC_LIVE_AUDIT_SCENARIOS.find(
      (candidate) => candidate.id === "act2-the-flinch"
    )!;
    const staging = ch1NpcLiveAuditStaging(scenario.input);
    const jackie = staging.find((row) => row.key === "jackie")!;
    const rook = staging.find((row) => row.key === "halden_rook")!;
    assert.deepEqual(jackie.position, CH1_ANCHORS.gate_desert_jackie_post);
    assert.deepEqual(rook.position, CH1_ANCHORS.gate_desert_rook_post);
    assert.ok(
      Math.hypot(
        jackie.position![0] - rook.position![0],
        jackie.position![2] - rook.position![2]
      ) >= 8
    );
  });

  it("keeps Iris and Marrow clear of Lovely Locks residents and each other", () => {
    const scenario = CH1_NPC_LIVE_AUDIT_SCENARIOS.find(
      (candidate) => candidate.id === "act3-lovely-locks"
    )!;
    const staging = ch1NpcLiveAuditStaging(scenario.input);
    const iris = staging.find((row) => row.key === "iris_fen")!.position!;
    const marrow = staging.find((row) => row.key === "marrow")!.position!;
    assert.deepEqual(iris, CH1_ANCHORS.lovely_locks_iris_post);
    assert.deepEqual(marrow, CH1_ANCHORS.lovely_locks_marrow_post);
    assert.ok(Math.hypot(iris[0] - marrow[0], iris[2] - marrow[2]) >= 4);

    const emily = CH1_TESTIMONY_NPC_SEEDS.find(
      (npc) => npc.displayName === "Emily"
    )!.position;
    const alexisProfile = SNAPSHOT_GROVE_NPCS.find(
      (npc) => npc.displayName === "Alexis"
    )!;
    const alexis = snapshotGroveGroundedPosition(
      alexisProfile.authoredPosition
    );
    for (const [actorName, actor] of [
      ["Iris", iris],
      ["Marrow", marrow],
    ] as const) {
      for (const [residentName, resident] of [
        ["Emily", emily],
        ["Alexis", alexis],
      ] as const) {
        assert.ok(
          Math.hypot(actor[0] - resident[0], actor[2] - resident[2]) > 8,
          `${actorName} must not share ${residentName}'s Talk radius`
        );
      }
    }
  });

  it("models accumulated Act 6 state with separate Greenlamp and Returnstone actors", () => {
    const greenlampScenario = CH1_NPC_LIVE_AUDIT_SCENARIOS.find(
      (candidate) => candidate.id === "act6-greenlamp"
    )!;
    const greenlamp = ch1NpcLiveAuditStaging(greenlampScenario.input);
    const louAtGreenlamp = greenlamp.find((row) => row.key === "lou_ardan")!;
    const nadiaAtGreenlamp = greenlamp.find(
      (row) => row.key === "nadia_sorrel"
    )!;
    assert.deepEqual(louAtGreenlamp.position, CH1_ANCHORS.returnstone_lou_post);
    assert.deepEqual(
      nadiaAtGreenlamp.position,
      CH1_ANCHORS.greenlamp_nadia_post
    );
    assert.deepEqual(greenlampScenario.focus, CH1_ANCHORS.greenlamp_nadia_post);

    const scenario = CH1_NPC_LIVE_AUDIT_SCENARIOS.find(
      (candidate) => candidate.id === "act6-returnstone"
    )!;
    assert.ok(scenario.input.flags.includes(CH1_FLAGS.gatePersistentOpen));
    const staging = ch1NpcLiveAuditStaging(scenario.input);
    const lou = staging.find((row) => row.key === "lou_ardan")!;
    const cressa = staging.find((row) => row.key === "cressa_vane")!;
    assert.equal(lou.present, true);
    assert.equal(cressa.present, true);
    assert.deepEqual(lou.position, CH1_ANCHORS.returnstone_lou_post);
    assert.deepEqual(cressa.position, CH1_ANCHORS.returnstone_cressa_post);
    assert.ok(
      Math.hypot(
        lou.position![0] - cressa.position![0],
        lou.position![2] - cressa.position![2]
      ) >= 8,
      "Lou and Cressa need distinct Returnstone interaction zones"
    );
    assert.deepEqual(scenario.focus, CH1_ANCHORS.returnstone_lou_post);
  });

  it("projects Holt only for the statement and keeps his shared North Gate body otherwise", () => {
    const ordinary = ch1ReturningNpcStageDirections({
      flags: [CH1_FLAGS.started],
    })[0];
    assert.equal(ordinary.entityId, Number(CH1_SERGEANT_HOLT.entityId));
    assert.equal(ordinary.useSeededBody, true);
    assert.equal(ordinary.position, undefined);

    const statement = ch1ReturningNpcStageDirections({
      flags: [CH1_FLAGS.started],
      activeStepId: "report_or_not",
    })[0];
    assert.equal(statement.useSeededBody, false);
    assert.deepEqual(statement.position, CH1_SERGEANT_HOLT.position);

    const shim = fs.readFileSync(
      path.join(process.cwd(), "src/server/shim/main.ts"),
      "utf8"
    );
    assert.doesNotMatch(
      shim,
      /npc\.id === CH1_SERGEANT_HOLT\.entityId/,
      "the shared seeder must not globally relocate Holt to the Grove"
    );
    assert.match(
      fs.readFileSync(
        path.join(process.cwd(), "src/shared/harthmere/ch1_returning_npcs.ts"),
        "utf8"
      ),
      /v2-per-player-staging/,
      "persisted worlds need a seed-version bump to return Holt to North Gate"
    );
  });

  it("gives every projected story actor an authored visual route", () => {
    for (const scenario of CH1_NPC_LIVE_AUDIT_SCENARIOS) {
      for (const row of ch1NpcLiveAuditStaging(scenario.input)) {
        if (!row.present || row.useSeededBody) continue;
        assert.ok(
          ch1CastVisualForEntity(row.entityId),
          `${scenario.id}/${row.key}`
        );
      }
    }
  });

  it("includes all testimony NPCs, suppliers, Road Ahead actors, and named quest givers", () => {
    const byId = new Map(
      CH1_SHARED_NPC_LIVE_AUDIT_ENTRIES.map((entry) => [
        Number(entry.entityId),
        entry,
      ])
    );
    assert.equal(byId.size, CH1_SHARED_NPC_LIVE_AUDIT_ENTRIES.length);
    for (const testimony of CH1_TESTIMONY_NPC_SEEDS) {
      assert.ok(
        byId
          .get(Number(testimony.entityId))
          ?.roles.includes("chapter1_testimony")
      );
    }
    for (const supplier of CH1_GROVE_SUPPLIER_ROUTE) {
      assert.ok(
        CH1_SHARED_NPC_LIVE_AUDIT_ENTRIES.some(
          (entry) =>
            entry.displayName === supplier.label &&
            entry.roles.includes("chapter1_supplier")
        ),
        supplier.label
      );
    }
    for (const name of ["Jackie", "Billy"]) {
      assert.ok(
        CH1_SHARED_NPC_LIVE_AUDIT_ENTRIES.some(
          (entry) =>
            entry.displayName === name && entry.roles.includes("road_ahead")
        ),
        name
      );
    }

    const castNames = new Set(CH1_NEW_CAST.map((member) => member.displayName));
    const sharedNames = new Set(
      CH1_SHARED_NPC_LIVE_AUDIT_ENTRIES.map((entry) => entry.displayName)
    );
    for (const giver of new Set(CH1_QUESTS.map((quest) => quest.giver))) {
      if (giver === "—" || giver === "Jobs Board") continue;
      assert.ok(
        castNames.has(giver) ||
          sharedNames.has(giver) ||
          giver === CH1_SERGEANT_HOLT.displayName,
        giver
      );
    }
  });

  it("exports resolved staging and visual routes through one browser catalog", () => {
    const catalog = ch1NpcLiveAuditCatalog();
    assert.equal(catalog.scenarios.length, CH1_NPC_LIVE_AUDIT_SCENARIOS.length);
    assert.equal(
      catalog.sharedNpcs.length,
      CH1_SHARED_NPC_LIVE_AUDIT_ENTRIES.length
    );
    assert.deepEqual(
      [...catalog.retiredNpcEntityIds].sort((a, b) => Number(a) - Number(b)),
      [...CH1_RETIRED_NPC_LIVE_AUDIT_ENTITY_IDS].sort(
        (a, b) => Number(a) - Number(b)
      )
    );
    assert.deepEqual(
      new Set(catalog.retiredNpcEntityIds),
      new Set(Object.values(SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS))
    );
    const statement = catalog.scenarios.find(
      (scenario) => scenario.id === "act4-statement"
    )!;
    const holt = statement.staging.find(
      (row) => row.key === "sergeant_bram_holt"
    )!;
    assert.deepEqual(holt.position, CH1_ANCHORS.grove_watch_house_holt_post);
    assert.equal(holt.visualRoute, "player_like");
  });

  it("keeps the browser bridge and fast guide wired to the complete matrix", () => {
    const bridge = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/client/game/e2e/harthmere_native_ecs_e2e.ts"
      ),
      "utf8"
    );
    const guide = fs.readFileSync(
      path.join(process.cwd(), "docs/harthmere/TESTING_FASTER.md"),
      "utf8"
    );
    for (const method of [
      "chapter1NpcAuditCatalog",
      "chapter1PrepareNpcAudit",
      "chapter1NpcPresentationSnapshot",
      "chapter1ClearNpcAudit",
    ]) {
      assert.match(bridge, new RegExp(`${method}\\b`), method);
    }
    assert.match(bridge, /ch1NpcLiveAuditStaging/);
    assert.match(bridge, /readChapter1PuppetOverrides/);
    assert.match(
      fs.readFileSync(
        path.join(process.cwd(), "src/server/shim/main.ts"),
        "utf8"
      ),
      /makeRetiredSnapshotGroveNpcChanges\(tick, service, worldApi\)/
    );
    assert.match(guide, /one full 335k-world lane/);
    assert.match(guide, /chapter1NpcAuditCatalog/);
  });
});
