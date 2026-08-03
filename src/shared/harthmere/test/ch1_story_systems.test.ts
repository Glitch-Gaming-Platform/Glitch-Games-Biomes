import assert from "node:assert/strict";
import { describe, it } from "mocha";

import {
  CH1_NEW_CAST,
  CH1_PROMOTED_CAST,
  CH1_RECLAIMED_CAST,
  CH1_SEEDED_CAST,
  ch1ValidateCastIdentity,
} from "@/shared/harthmere/ch1_cast";
import {
  CH1_DOCUMENTS,
  ch1Document,
  ch1DocumentPages,
  ch1UnlockedDocumentsFor,
  ch1ValidateDocuments,
} from "@/shared/harthmere/ch1_documents";
import {
  CH1_FRAGMENTS,
  CH1_LINK_RECIPES,
  ch1AvailableLinkRecipes,
  ch1EmptyLedger,
  ch1Fragment,
  ch1LinkRecipeFor,
  ch1RecoverFragment,
} from "@/shared/harthmere/ch1_fragment_ledger";
import {
  CH1_AMBIENT_FRAGMENT_TRIGGERS,
  CH1_STRESS_HEALTH_FRACTION,
  ch1EvaluateAmbientTrigger,
  ch1ValidateAmbientTriggers,
} from "@/shared/harthmere/ch1_fragment_triggers";
import {
  CH1_GROVE_DAY_MS,
  ch1GroveSideElapsedMs,
  ch1GroveSideElapsedSummary,
  ch1ValidateAllGates,
} from "@/shared/harthmere/ch1_fracture_gates";
import {
  CH1_ANCHORS,
  CH1_FLAGS,
  ch1ForbiddenSubstrings,
  ch1NpcEntityId,
} from "@/shared/harthmere/ch1_ids";
import { SNAPSHOT_GROVE_MUCKED_ROBOT_ENTITY_ID } from "@/shared/harthmere/snapshot_grove_ids";
import {
  ch1StageDirectionFor,
  ch1StageDirections,
  ch1ValidateStaging,
  ch1WorldPhaseEffects,
} from "@/shared/harthmere/ch1_staging";

describe("Chapter 1 memory catalog depth", () => {
  it("ships the authored thirty-fragment scope", () => {
    assert.equal(CH1_FRAGMENTS.length, 30);
  });

  it("ships six reconstructions, which is where the chapter can lie", () => {
    const reconstructions = CH1_FRAGMENTS.filter(
      (fragment) => fragment.type === "reconstruction"
    );
    assert.equal(reconstructions.length, 6);
  });

  it("offers more than one way to build a timeline", () => {
    assert.ok(
      CH1_LINK_RECIPES.length >= 3,
      "Act 5 linking with a single recipe is a button, not a board"
    );
    for (const recipe of CH1_LINK_RECIPES) {
      assert.ok(
        ch1Fragment(recipe.derives),
        `${recipe.derives}: derived fragment is not in the catalog`
      );
      for (const source of recipe.sources) {
        assert.ok(
          ch1Fragment(source),
          `${recipe.derives}: source ${source} is not in the catalog`
        );
      }
      assert.equal(
        ch1LinkRecipeFor([...recipe.sources].reverse())?.derives,
        recipe.derives,
        "recipes must match regardless of the order the player drags them in"
      );
    }
  });

  it("never lets two recipes derive the same fragment", () => {
    const derived = CH1_LINK_RECIPES.map((recipe) => recipe.derives);
    assert.equal(new Set(derived).size, derived.length);
  });

  it("only offers a link once every source is in the ledger", () => {
    const recipe = CH1_LINK_RECIPES[0];
    let ledger = { ...ch1EmptyLedger(), linkingUnlocked: true };
    assert.equal(ch1AvailableLinkRecipes(ledger).length, 0);
    for (const source of recipe.sources) {
      ledger = ch1RecoverFragment(ledger, source, 1);
    }
    assert.ok(
      ch1AvailableLinkRecipes(ledger).some((r) => r.derives === recipe.derives)
    );
    ledger = ch1RecoverFragment(ledger, recipe.derives, 2);
    assert.ok(
      !ch1AvailableLinkRecipes(ledger).some(
        (r) => r.derives === recipe.derives
      ),
      "a completed link must not be offered again"
    );
  });

  it("keeps linking locked until Act 5", () => {
    let ledger = ch1EmptyLedger();
    for (const source of CH1_LINK_RECIPES[0].sources) {
      ledger = ch1RecoverFragment(ledger, source, 1);
    }
    assert.equal(ch1AvailableLinkRecipes(ledger).length, 0);
  });
});

describe("Chapter 1 ambient fragment triggers", () => {
  const baseContext = {
    position: [...CH1_ANCHORS.old_grove_road_post] as [number, number, number],
    flags: [CH1_FLAGS.started, CH1_FLAGS.act1Complete],
    itemIds: ["item_grey_card"],
    latentSkillIds: [] as string[],
    recoveredFragmentIds: [] as string[],
    availablePlaybackIds: [] as string[],
  };

  it("passes its own structural validation", () => {
    assert.deepEqual(ch1ValidateAmbientTriggers(), []);
  });

  it("makes every authored fragment reachable by quest step or trigger", () => {
    // Derived fragments are produced by linking, and the intake window is
    // produced by the consolidation; everything else must have a way in.
    const viaTrigger = new Set(
      CH1_AMBIENT_FRAGMENT_TRIGGERS.map((entry) => entry.fragmentId)
    );
    const unreachable = CH1_FRAGMENTS.filter(
      (fragment) =>
        fragment.type !== "derived" &&
        fragment.trigger !== "link" &&
        fragment.id !== "frag_a6_the_intake_window" &&
        !viaTrigger.has(fragment.id) &&
        !questStepFragmentIds().has(fragment.id)
    ).map((fragment) => fragment.id);
    assert.deepEqual(unreachable, []);
  });

  it("refuses a place trigger from the wrong place", () => {
    const result = ch1EvaluateAmbientTrigger({
      fragmentId: "frag_a2_echo_lamps_out",
      kind: "place",
      context: {
        ...baseContext,
        position: [...CH1_ANCHORS.harthmere_bridge_center] as [
          number,
          number,
          number,
        ],
      },
    });
    assert.equal(result.ok, false);
  });

  it("accepts a place trigger from the authored anchor", () => {
    const result = ch1EvaluateAmbientTrigger({
      fragmentId: "frag_a2_echo_lamps_out",
      kind: "place",
      context: baseContext,
    });
    assert.equal(result.ok, true);
  });

  it("refuses a client that reports the wrong trigger class", () => {
    const result = ch1EvaluateAmbientTrigger({
      fragmentId: "frag_a2_echo_lamps_out",
      kind: "stress",
      context: baseContext,
    });
    assert.equal(result.ok, false);
  });

  it("requires real health for a stress trigger", () => {
    const healthy = ch1EvaluateAmbientTrigger({
      fragmentId: "frag_a1_echo_get_back",
      kind: "stress",
      context: { ...baseContext, healthFraction: 0.9 },
    });
    assert.equal(healthy.ok, false);
    const nearlyDead = ch1EvaluateAmbientTrigger({
      fragmentId: "frag_a1_echo_get_back",
      kind: "stress",
      context: {
        ...baseContext,
        healthFraction: CH1_STRESS_HEALTH_FRACTION - 0.01,
      },
    });
    assert.equal(nearlyDead.ok, true);
  });

  it("requires the plot item a trigger claims to need", () => {
    const empty = ch1EvaluateAmbientTrigger({
      fragmentId: "frag_a2_overlay_the_cove_glass",
      kind: "place",
      context: {
        ...baseContext,
        itemIds: [],
        position: [...CH1_ANCHORS.shutter_cove_photo_marker] as [
          number,
          number,
          number,
        ],
      },
    });
    assert.equal(empty.ok, false);
  });

  it("stays silent while the player has stopped taking the tea", () => {
    const result = ch1EvaluateAmbientTrigger({
      fragmentId: "frag_a2_echo_lamps_out",
      kind: "place",
      context: {
        ...baseContext,
        flags: [CH1_FLAGS.started, CH1_FLAGS.dosingStopped],
      },
    });
    assert.equal(result.ok, false);
  });

  it("never gates an act-1 memory behind an act-5 flag by accident", () => {
    for (const trigger of CH1_AMBIENT_FRAGMENT_TRIGGERS) {
      const fragment = ch1Fragment(trigger.fragmentId)!;
      if (fragment.act > 1) continue;
      assert.deepEqual(
        (trigger.requiresFlags ?? []).filter(
          (flag) => flag !== CH1_FLAGS.started
        ),
        [],
        `${trigger.fragmentId}: an act-1 memory must not need later flags`
      );
    }
  });
});

describe("Chapter 1 documents", () => {
  it("passes its own structural validation", () => {
    assert.deepEqual(ch1ValidateDocuments(), []);
  });

  it("never re-locks a document once it is unlocked", () => {
    const early = ch1UnlockedDocumentsFor([CH1_FLAGS.act2Complete]);
    const late = ch1UnlockedDocumentsFor([
      CH1_FLAGS.act2Complete,
      CH1_FLAGS.act3Complete,
      CH1_FLAGS.act6TruthKnown,
    ]);
    for (const doc of early) {
      assert.ok(
        late.some((candidate) => candidate.id === doc.id),
        `${doc.id} disappeared from the reader as the story advanced`
      );
    }
  });

  it("adds the field ledger's closing page only after the handover", () => {
    const before = ch1DocumentPages("doc_field_ledger", [CH1_FLAGS.hasLedger]);
    const after = ch1DocumentPages("doc_field_ledger", [
      CH1_FLAGS.hasLedger,
      CH1_FLAGS.ledgerSurrendered,
    ]);
    assert.equal(after.length, before.length + 1);
    // Nothing the player already read may change underneath them.
    assert.deepEqual(after.slice(0, before.length), before);
  });

  it("keeps every reveal term out of pre-Act-6 documents", () => {
    for (const doc of CH1_DOCUMENTS) {
      if (doc.unlockedBy === CH1_FLAGS.act6TruthKnown) continue;
      for (const page of doc.pages) {
        assert.deepEqual(
          ch1ForbiddenSubstrings(
            `${doc.title} ${page.heading ?? ""} ${page.body}`
          ),
          [],
          `${doc.id}: leaks a reveal term before Act 6`
        );
      }
    }
  });

  it("keeps the case notes free of any sentence the reveal would falsify", () => {
    // The document's deceit is by omission only. If a page ever claims the
    // patient consented, was discharged normally, or arrived already impaired,
    // the reveal turns it into a lie and the chapter has cheated.
    const notes = ch1Document("doc_lou_case_notes")!;
    const text = notes.pages
      .map((page) => page.body)
      .join(" ")
      .toLowerCase();
    for (const forbidden of [
      "consented",
      "signed the consent",
      "discharged normally",
      "arrived impaired",
    ]) {
      assert.ok(
        !text.includes(forbidden),
        `case notes contain "${forbidden}", which the reveal makes untrue`
      );
    }
  });
});

describe("Chapter 1 staging", () => {
  it("passes its own structural validation", () => {
    assert.deepEqual(ch1ValidateStaging(), []);
  });

  it("resolves every character in every story state", () => {
    for (const flags of [
      [],
      [CH1_FLAGS.started],
      [CH1_FLAGS.started, CH1_FLAGS.metLou],
      [CH1_FLAGS.started, CH1_FLAGS.act5Complete],
      [CH1_FLAGS.started, CH1_FLAGS.complete, CH1_FLAGS.ledgerSurrendered],
    ]) {
      const staged = ch1StageDirections({ flags });
      assert.equal(staged.length, CH1_NEW_CAST.length);
      for (const npc of staged) {
        assert.ok(npc.activity.length > 0, `${npc.key}: no activity line`);
      }
    }
  });

  it("keeps every promoted world NPC at its shared home before Chapter 1", () => {
    const before = new Map(
      ch1StageDirections({ flags: [] }).map((npc) => [npc.key, npc])
    );
    for (const member of CH1_PROMOTED_CAST) {
      const staged = before.get(member.key);
      assert.ok(staged, `${member.key}: missing pre-chapter stage direction`);
      assert.equal(
        staged.useSeededBody,
        true,
        `${member.key}: a promoted shared NPC was moved for players who have not started Chapter 1`
      );
      assert.equal(
        staged.position,
        undefined,
        `${member.key}: pre-chapter projection must retain the ECS-authored home`
      );
    }
  });

  it("moves Jackie from her starter-world home only after Chapter 1 starts", () => {
    const before = ch1StageDirections({ flags: [] }).find(
      (npc) => npc.key === "jackie"
    );
    assert.equal(before?.useSeededBody, true);
    assert.equal(before?.position, undefined);

    const started = ch1StageDirections({ flags: [CH1_FLAGS.started] }).find(
      (npc) => npc.key === "jackie"
    );
    assert.equal(started?.useSeededBody, false);
    assert.deepEqual(started?.position, [...CH1_ANCHORS.roadhouse_jackie_post]);

    const fence = ch1StageDirections({
      flags: [CH1_FLAGS.started],
      activeStepId: "walk_with_jackie",
    }).find((npc) => npc.key === "jackie");
    assert.deepEqual(fence?.position, [...CH1_ANCHORS.broken_safe_zone_fence]);
  });

  it("moves Rook to the Mouth he is actually watching", () => {
    const bridge = ch1StageDirectionFor("halden_rook", {
      flags: [CH1_FLAGS.started],
    });
    assert.deepEqual(bridge?.place, {
      kind: "anchor",
      anchor: "harthmere_bridge_center",
    });
    const desert = ch1StageDirectionFor("halden_rook", {
      flags: [CH1_FLAGS.started, CH1_FLAGS.gatePersistentOpen],
    });
    assert.deepEqual(desert?.place, {
      kind: "anchor",
      anchor: "gate_desert_rook_post",
    });
    const winter = ch1StageDirectionFor("halden_rook", {
      flags: [
        CH1_FLAGS.started,
        CH1_FLAGS.gatePersistentOpen,
        CH1_FLAGS.act4Complete,
      ],
    });
    assert.deepEqual(winter?.place, { kind: "anchor", anchor: "gate_winter" });
  });

  it("brings Iris and Marrow home and takes Lou and Sorrel away", () => {
    const after = ch1StageDirections({
      flags: [
        CH1_FLAGS.started,
        CH1_FLAGS.irisRescued,
        CH1_FLAGS.marrowSaved,
        CH1_FLAGS.metLou,
        CH1_FLAGS.act5Complete,
        CH1_FLAGS.ledgerSurrendered,
      ],
    });
    const byKey = new Map(after.map((npc) => [npc.key, npc]));
    assert.deepEqual(byKey.get("iris_fen")?.position, [
      ...CH1_ANCHORS.lovely_locks_iris_post,
    ]);
    assert.deepEqual(byKey.get("marrow")?.position, [
      ...CH1_ANCHORS.lovely_locks_marrow_post,
    ]);
    assert.equal(byKey.get("lou_ardan")?.present, false);
    assert.equal(byKey.get("nadia_sorrel")?.present, false);
  });

  it("presents AUGUR-9 as the Mucked Robot until the chapter starts", () => {
    const before = ch1StageDirections({ flags: [] }).find(
      (npc) => npc.key === "augur9"
    );
    assert.equal(before?.displayName, "Mucked Robot");
    assert.equal(before?.useSeededBody, true);
    const after = ch1StageDirections({ flags: [CH1_FLAGS.started] }).find(
      (npc) => npc.key === "augur9"
    );
    assert.equal(after?.displayName, "AUGUR-9");
    assert.equal(after?.useSeededBody, true);
  });

  it("gives every ending and both Hallr outcomes a visible consequence", () => {
    for (const ending of ["confess", "contain", "bargain"] as const) {
      const effects = ch1WorldPhaseEffects({
        flags: [CH1_FLAGS.complete, CH1_FLAGS.ledgerSurrendered],
        ending,
      });
      assert.ok(
        effects.length >= 3,
        `${ending}: an ending must do more than set a flag`
      );
    }
    assert.notDeepEqual(
      ch1WorldPhaseEffects({ flags: [], hallrChoice: "let_run" }),
      ch1WorldPhaseEffects({ flags: [], hallrChoice: "hold_stall" })
    );
  });
});

describe("Chapter 1 cast identity", () => {
  it("passes its own structural validation", () => {
    assert.deepEqual(ch1ValidateCastIdentity(), []);
  });

  it("claims the existing Mucked Robot instead of seeding a twin", () => {
    assert.equal(
      Number(ch1NpcEntityId("augur9")),
      Number(SNAPSHOT_GROVE_MUCKED_ROBOT_ENTITY_ID)
    );
    assert.deepEqual(
      CH1_PROMOTED_CAST.map((member) => member.key),
      ["jackie", "augur9", "coretta"]
    );
    assert.ok(
      !CH1_SEEDED_CAST.some((member) => member.key === "augur9"),
      "seeding AUGUR-9 would recreate the duplicate robot"
    );
    assert.equal(CH1_SEEDED_CAST.length, CH1_NEW_CAST.length - 3);
    assert.deepEqual(
      CH1_RECLAIMED_CAST.map((member) => member.key),
      ["lou_ardan", "cressa_vane", "halden_rook", "nadia_sorrel", "iris_fen"]
    );
  });
});

describe("Chapter 1 time dilation", () => {
  it("passes gate placement validation", () => {
    assert.deepEqual(ch1ValidateAllGates(), []);
  });

  it("delivers the authored beat even for a fast run", () => {
    const twoHours = 2 * 60 * 60 * 1000;
    assert.ok(
      ch1GroveSideElapsedMs("ch1_gate_desert", twoHours) >=
        CH1_GROVE_DAY_MS * 3,
      "Act 3 closes on a Grove that has had three days"
    );
    assert.ok(
      ch1GroveSideElapsedMs("ch1_gate_winter", twoHours) >=
        CH1_GROVE_DAY_MS * 2,
      "Act 5 closes on a Grove that has had two days"
    );
  });

  it("still punishes a slow run above the floor", () => {
    const veryLong = 20 * 60 * 60 * 1000;
    assert.ok(
      ch1GroveSideElapsedMs("ch1_gate_desert", veryLong) > CH1_GROVE_DAY_MS * 3
    );
  });

  it("summarizes the beat in plain words", () => {
    assert.equal(
      ch1GroveSideElapsedSummary("ch1_gate_desert", 60_000),
      "The Grove has had 3 days."
    );
  });
});

// ---------------------------------------------------------------------------

function questStepFragmentIds(): Set<string> {
  // Imported lazily so this helper does not pull the quest catalogue into
  // module scope for the catalog-only assertions above.
  const { CH1_QUESTS } =
    require("@/shared/harthmere/ch1_quests") as typeof import("@/shared/harthmere/ch1_quests");
  const ids = new Set<string>();
  for (const quest of CH1_QUESTS) {
    for (const step of quest.steps) {
      if (step.fragmentId) ids.add(step.fragmentId);
    }
  }
  // Authored in ch1_live_story.ts rather than on a step: the ledger tab opening
  // makes this playback available.
  ids.add("frag_a2_play_the_ninth_signature");
  return ids;
}
