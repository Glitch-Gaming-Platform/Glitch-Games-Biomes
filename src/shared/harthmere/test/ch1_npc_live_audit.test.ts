import assert from "assert";
import fs from "fs";
import path from "path";
import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import { ch1CastVisualForEntity } from "@/shared/harthmere/ch1_cast_visuals";
import { CH1_ANCHORS, CH1_FLAGS } from "@/shared/harthmere/ch1_ids";
import {
  CH1_NPC_LIVE_AUDIT_SCENARIOS,
  CH1_SHARED_NPC_LIVE_AUDIT_ENTRIES,
  ch1NpcLiveAuditCatalog,
  ch1NpcLiveAuditStaging,
} from "@/shared/harthmere/ch1_npc_live_audit";
import { CH1_GROVE_SUPPLIER_ROUTE } from "@/shared/harthmere/ch1_objective_routes";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";
import {
  CH1_SERGEANT_HOLT,
  ch1ReturningNpcStageDirections,
} from "@/shared/harthmere/ch1_returning_npcs";
import { CH1_TESTIMONY_NPC_SEEDS } from "@/shared/harthmere/ch1_testimony_npcs";

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
    const expected = new Map([
      ["starter-jackie-road-ahead", undefined],
      ["act1-roadhouse", CH1_ANCHORS.roadhouse_jackie_post],
      ["act1-fence-walk", CH1_ANCHORS.broken_safe_zone_fence],
      ["act1-first-seam", CH1_ANCHORS.gate_fence_sighting],
      ["act2-the-flinch", CH1_ANCHORS.gate_desert],
      ["act4-statement", CH1_ANCHORS.grove_watch_house],
      ["act6-watch-house", CH1_ANCHORS.grove_watch_house],
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
    const statement = catalog.scenarios.find(
      (scenario) => scenario.id === "act4-statement"
    )!;
    const holt = statement.staging.find(
      (row) => row.key === "sergeant_bram_holt"
    )!;
    assert.deepEqual(holt.position, CH1_ANCHORS.grove_watch_house);
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
    assert.match(guide, /one full 335k-world lane/);
    assert.match(guide, /chapter1NpcAuditCatalog/);
  });
});
