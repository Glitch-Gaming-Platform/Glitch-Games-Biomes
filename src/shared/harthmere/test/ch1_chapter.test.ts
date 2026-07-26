/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  CH1_ANCHORS,
  CH1_FLAGS,
  CH1_HARTHMERE_BRIDGE_X,
  CH1_NPC_ENTITY_IDS,
  ch1ForbiddenSubstrings,
  ch1NpcEntityId,
  isCh1LegalGatePosition,
} from "../ch1_ids";
import {
  CH1_CONSOLIDATION_ORDER,
  CH1_FRAGMENTS,
  CH1_LINK_RECIPES,
  ch1ApplyConsolidation,
  ch1ConsolidationFragments,
  ch1EmptyLedger,
  ch1Fragment,
  ch1FragmentDeliveryEnabled,
  ch1LedgerDisplayOrder,
  ch1LinkRecipeFor,
  ch1RecoverFragment,
  ch1VisibleBody,
  ch1VisibleConfidence,
} from "../ch1_fragment_ledger";
import {
  CH1_CONTAINMENT_CAN_FAIL,
  CH1_LATENT_SKILLS,
  ch1ContainmentNominalSeconds,
  ch1EmptyLatentSkills,
  ch1HasLatentSkill,
  ch1UnlockLatentSkill,
} from "../ch1_latent_skills";
import {
  CH1_FRACTURE_GATES,
  CH1_PROVISIONING,
  ch1ActiveGates,
  ch1CheckProvisioning,
  ch1GroveSideElapsedMs,
  ch1ValidateAllGates,
} from "../ch1_fracture_gates";
import {
  CH1_DUNGEONS,
  ch1DungeonMinutes,
  ch1DungeonRunComplete,
  ch1ValidateAllDungeons,
} from "../ch1_dungeons";
import {
  CH1_ELSEWHEN_BAND_START_X,
  CH1_ELSEWHEN_SLOTS,
  ch1AdmitToElsewhen,
  ch1ElsewhenSlotAt,
  ch1ElsewhenTerrainEntityIdForShard,
  ch1ShardMayGenerate,
  ch1ValidateElsewhenRegion,
  isInsideCh1ElsewhenBand,
  isInsideCh1VoidGap,
} from "../ch1_elsewhen_region";
import {
  CH1_QUESTS,
  ch1ActCloseQuest,
  ch1QuestCutsceneIds,
  ch1QuestFragmentIds,
  ch1QuestLatentSkillIds,
  ch1QuestsForAct,
} from "../ch1_quests";
import {
  CH1_TESTIMONIES,
  CH1_TESTIMONY_REWARD_FRAGMENT,
  CH1_NEW_CAST,
  ch1TestimoniesComplete,
} from "../ch1_cast";
import { CH1_ITEMS, ch1ItemDescription, ch1ItemDisplayName } from "../ch1_items";
import {
  CH1_ACT_COUNT,
  CH1_ENDING_DEFS,
  ch1AvailableQuestIds,
  ch1ChooseEnding,
  ch1CurrentAct,
  ch1EnterGate,
  ch1ExitGate,
  ch1InitialPlayerState,
  ch1SetFlag,
  ch1ValidateActStructure,
} from "../ch1_chapter";
import { ch1ValidateEngineContracts } from "../ch1_engine_contracts";

// ---------------------------------------------------------------------------

describe("ch1 - fragment ledger", () => {
  it("has no truth field anywhere in the shared catalog", () => {
    // The whole fair-play design depends on truth never reaching the client
    // bundle. If someone adds `truth` to the shared def, this fails.
    for (const frag of CH1_FRAGMENTS) {
      assert.ok(
        !("truth" in (frag as unknown as Record<string, unknown>)),
        `${frag.id} leaks a truth value into the shared catalog`
      );
    }
  });

  it("recovers fragments idempotently", () => {
    let ledger = ch1EmptyLedger();
    ledger = ch1RecoverFragment(ledger, "frag_a1_echo_get_back", 1000);
    ledger = ch1RecoverFragment(ledger, "frag_a1_echo_get_back", 2000);
    assert.equal(ledger.entries.length, 1);
    assert.equal(ledger.entries[0].recoveredAtMs, 1000);
  });

  it("rejects unknown fragments", () => {
    assert.throws(() =>
      ch1RecoverFragment(ch1EmptyLedger(), "frag_does_not_exist", 0)
    );
  });

  it("hides confidence until Act 5 linking is unlocked", () => {
    let ledger = ch1EmptyLedger();
    ledger = ch1RecoverFragment(ledger, "frag_a3_recon_corridor", 10);
    assert.equal(
      ch1VisibleConfidence(ledger, "frag_a3_recon_corridor"),
      undefined
    );
    ledger = { ...ledger, linkingUnlocked: true };
    assert.equal(ch1VisibleConfidence(ledger, "frag_a3_recon_corridor"), 91);
  });

  it("shows the ledger newest first", () => {
    let ledger = ch1EmptyLedger();
    ledger = ch1RecoverFragment(ledger, "frag_a1_echo_get_back", 100);
    ledger = ch1RecoverFragment(ledger, "frag_a2_echo_lamps_out", 300);
    ledger = ch1RecoverFragment(ledger, "frag_a2_play_the_ninth_signature", 200);
    const order = ch1LedgerDisplayOrder(ledger).map((e) => e.fragmentId);
    assert.deepEqual(order, [
      "frag_a2_echo_lamps_out",
      "frag_a2_play_the_ninth_signature",
      "frag_a1_echo_get_back",
    ]);
  });

  it("stops delivering fragments while dosing is stopped", () => {
    assert.equal(ch1FragmentDeliveryEnabled([CH1_FLAGS.started]), true);
    assert.equal(
      ch1FragmentDeliveryEnabled([CH1_FLAGS.started, CH1_FLAGS.dosingStopped]),
      false,
      "the ledger must go quiet for the back half of Act 4"
    );
    assert.equal(
      ch1FragmentDeliveryEnabled([
        CH1_FLAGS.started,
        CH1_FLAGS.dosingStopped,
        CH1_FLAGS.dosingResumed,
      ]),
      true
    );
    assert.equal(ch1FragmentDeliveryEnabled([]), false);
  });

  it("consolidation rewrites exactly six entries and is idempotent", () => {
    assert.equal(CH1_CONSOLIDATION_ORDER.length, 6);
    let ledger = ch1EmptyLedger();
    for (const id of CH1_CONSOLIDATION_ORDER) {
      if (id !== "frag_a6_the_intake_window") {
        ledger = ch1RecoverFragment(ledger, id, 100);
      }
    }
    const once = ch1ApplyConsolidation(ledger);
    const twice = ch1ApplyConsolidation(once);
    assert.equal(once.consolidated, true);
    assert.strictEqual(once, twice, "consolidation must be idempotent");
    assert.ok(
      once.entries.every((e) => e.revised),
      "every consolidated entry is marked revised"
    );
    assert.ok(
      once.entries.some((e) => e.fragmentId === "frag_a6_the_intake_window"),
      "the intake window is recovered BY the consolidation"
    );
  });

  it("revision flips the corridor from high to low confidence", () => {
    let ledger = ch1EmptyLedger();
    ledger = ch1RecoverFragment(ledger, "frag_a3_recon_corridor", 1);
    ledger = { ...ledger, linkingUnlocked: true };
    assert.equal(ch1VisibleConfidence(ledger, "frag_a3_recon_corridor"), 91);
    const after = ch1ApplyConsolidation(ledger);
    assert.equal(ch1VisibleConfidence(after, "frag_a3_recon_corridor"), 12);
    assert.notEqual(
      ch1VisibleBody(after, "frag_a3_recon_corridor"),
      ch1VisibleBody(ledger, "frag_a3_recon_corridor")
    );
  });

  it("every consolidation entry has revised copy", () => {
    for (const frag of ch1ConsolidationFragments()) {
      if (frag.id === "frag_a6_the_intake_window") {
        continue;
      }
      assert.ok(frag.revisedBody, `${frag.id} needs revisedBody`);
      assert.ok(
        frag.revisedConfidence !== undefined,
        `${frag.id} needs revisedConfidence`
      );
    }
  });

  it("link recipes reference real fragments", () => {
    for (const recipe of CH1_LINK_RECIPES) {
      for (const src of recipe.sources) {
        assert.ok(ch1Fragment(src), `link source ${src} does not exist`);
      }
      assert.ok(
        ch1Fragment(recipe.derives),
        `derived fragment ${recipe.derives} does not exist`
      );
    }
    const recipe = ch1LinkRecipeFor([
      "frag_a5_play_decimal_place",
      "frag_a2_play_the_ninth_signature",
      "frag_a3_play_ninth_paper",
    ]);
    assert.equal(recipe?.derives, "frag_a5_link_the_recommendation");
  });
});

// ---------------------------------------------------------------------------

describe("ch1 - latent skills", () => {
  it("arrive already mastered and cannot be explained", () => {
    for (const skill of CH1_LATENT_SKILLS) {
      assert.equal(
        skill.tooltip,
        "You know how to do this.",
        `${skill.id} must ship the unexplaining tooltip`
      );
      assert.ok(
        skill.explanationFailures.length >= 3,
        `${skill.id} needs at least three failed-explanation lines`
      );
      // The scene only works if the player cannot explain themselves. We do
      // not force every line to contain the literal words — "I was going to
      // ask you the same thing" is the same admission and better writing —
      // but at least one must say it plainly, and none may actually explain.
      assert.ok(
        skill.explanationFailures.some((line) => /don't know/i.test(line)),
        `${skill.id}: at least one option must plainly say "I don't know"`
      );
      for (const line of skill.explanationFailures) {
        assert.ok(
          !/\bbecause\b|\bso that\b|\bthe reason\b/i.test(line),
          `${skill.id}: "${line}" explains something. The player cannot explain.`
        );
      }
    }
  });

  it("the containment sequence cannot be failed", () => {
    assert.equal(CH1_CONTAINMENT_CAN_FAIL, false);
    assert.equal(
      ch1ContainmentNominalSeconds(),
      31,
      "the scene is called Thirty-One Seconds"
    );
  });

  it("unlocks idempotently", () => {
    let state = ch1EmptyLatentSkills();
    state = ch1UnlockLatentSkill(state, "ls_gate_timing");
    state = ch1UnlockLatentSkill(state, "ls_gate_timing");
    assert.equal(state.unlocked.length, 1);
    assert.ok(ch1HasLatentSkill(state, "ls_gate_timing"));
    assert.throws(() =>
      ch1UnlockLatentSkill(state, "ls_not_real" as never)
    );
  });
});

// ---------------------------------------------------------------------------

describe("ch1 - fracture gates", () => {
  it("passes structural validation", () => {
    assert.deepEqual(ch1ValidateAllGates(), []);
  });

  it("NEVER spawns a gate east of the Harthmere bridge", () => {
    // Story-critical: Harthmere refuses Exotic Matter, so it has no anchors,
    // so it has no Mouths. Rook says so and the player cannot argue.
    for (const gate of CH1_FRACTURE_GATES) {
      assert.ok(
        gate.position[0] < CH1_HARTHMERE_BRIDGE_X,
        `${gate.id} at x=${gate.position[0]} is in Harthmere territory`
      );
      assert.ok(isCh1LegalGatePosition(gate.position));
    }
    assert.equal(
      isCh1LegalGatePosition([CH1_HARTHMERE_BRIDGE_X + 1, 71, 0]),
      false
    );
    assert.equal(
      isCh1LegalGatePosition(CH1_ANCHORS.harthmere_bridge_center),
      false
    );
  });

  it("gates only exist once their story flag is set", () => {
    assert.deepEqual(ch1ActiveGates([]).map((g) => g.id), []);
    const early = ch1ActiveGates([CH1_FLAGS.started]).map((g) => g.id);
    assert.deepEqual(early, ["ch1_gate_fence_sighting"]);
    const late = ch1ActiveGates([
      CH1_FLAGS.started,
      CH1_FLAGS.act2Complete,
      CH1_FLAGS.act4Complete,
    ]).map((g) => g.id);
    assert.ok(late.includes("ch1_gate_desert"));
    assert.ok(late.includes("ch1_gate_winter"));
    assert.ok(!late.includes("ch1_gate_prime"));
  });

  it("time dilation is per-gate and inconsistent on purpose", () => {
    // Ninety minutes in the desert becomes about three days in the Grove.
    const insideMs = 90 * 60 * 1000;
    const grove = ch1GroveSideElapsedMs("ch1_gate_desert", insideMs);
    const days = grove / (24 * 60 * 60 * 1000);
    assert.ok(days > 0.4 && days < 0.7, `expected ~half a day-cycle, got ${days}`);
    assert.notEqual(
      ch1GroveSideElapsedMs("ch1_gate_desert", insideMs),
      ch1GroveSideElapsedMs("ch1_gate_winter", insideMs),
      "gates must not share a dilation factor"
    );
    assert.throws(() => ch1GroveSideElapsedMs("nope", 1));
  });

  it("provisioning is a hard block sourced from multiple NPCs", () => {
    for (const check of CH1_PROVISIONING) {
      assert.equal(check.hardBlock, true);
      const suppliers = new Set(check.requirements.map((r) => r.sourceNpc));
      assert.ok(
        suppliers.size >= 5,
        `${check.gateId}: provisioning must span the Grove economy, not one shop`
      );
    }
    const empty = ch1CheckProvisioning("ch1_gate_desert", {});
    assert.equal(empty.ok, false);
    assert.ok(empty.missing.length > 0);

    const full: Record<string, number> = {};
    for (const r of CH1_PROVISIONING[0].requirements) {
      full[r.key] = r.quantity;
    }
    assert.equal(ch1CheckProvisioning("ch1_gate_desert", full).ok, true);
  });
});

// ---------------------------------------------------------------------------

describe("ch1 - dungeons", () => {
  it("passes structural validation", () => {
    assert.deepEqual(ch1ValidateAllDungeons(), []);
  });

  it("has no merchants, rest nodes, or resupply anywhere", () => {
    for (const dungeon of CH1_DUNGEONS) {
      for (const zone of dungeon.zones) {
        assert.equal(zone.hasMerchant, false, `${zone.id} has a merchant`);
        assert.equal(zone.hasRestNode, false, `${zone.id} has a rest node`);
      }
    }
  });

  it("each dungeon runs 2-3 hours", () => {
    for (const dungeon of CH1_DUNGEONS) {
      const minutes = ch1DungeonMinutes(dungeon);
      assert.ok(
        minutes >= 120 && minutes <= 200,
        `${dungeon.id} is ${minutes} minutes`
      );
    }
  });

  it("is a retrieval, not a clear", () => {
    for (const dungeon of CH1_DUNGEONS) {
      const required = dungeon.retrievals.filter((r) => r.required);
      assert.ok(required.length > 0, `${dungeon.id} retrieves nothing`);
    }
    assert.equal(
      ch1DungeonRunComplete("ch1_dungeon_desert", ["item_first_grain"]),
      false,
      "leaving the child behind is not completion"
    );
    assert.equal(
      ch1DungeonRunComplete("ch1_dungeon_desert", [
        "item_first_grain",
        "npc_iris_fen",
      ]),
      true
    );
  });

  it("uses a different attrition resource per era", () => {
    const resources = CH1_DUNGEONS.map((d) => d.attrition);
    assert.deepEqual([...new Set(resources)].sort(), ["fuel", "water"]);
  });

  it("Hallr's choice is not scored", () => {
    const winter = CH1_DUNGEONS.find((d) => d.id === "ch1_dungeon_winter");
    assert.equal(winter?.choice?.scored, false);
    assert.equal(winter?.choice?.options.length, 2);
  });
});

// ---------------------------------------------------------------------------

describe("ch1 - Elsewhen region (warp-only dungeon band)", () => {
  it("passes structural validation", () => {
    assert.deepEqual(ch1ValidateElsewhenRegion(), []);
  });

  it("is separated from the reachable world by an empty void gap", () => {
    assert.equal(isInsideCh1VoidGap([2560, 64, 0] as never), true);
    assert.equal(isInsideCh1VoidGap([2600, 64, 0] as never), true);
    assert.equal(isInsideCh1VoidGap([CH1_ELSEWHEN_BAND_START_X, 64, 0] as never), false);
    // No shard may straddle or fill the gap.
    for (let shardX = 78; shardX <= 84; shardX++) {
      const minBlockX = shardX * 32;
      const inGap = minBlockX + 32 > 2560 && minBlockX < CH1_ELSEWHEN_BAND_START_X;
      assert.equal(
        ch1ShardMayGenerate(shardX),
        !inGap,
        `shard ${shardX} generation decision is wrong`
      );
    }
  });

  it("no Grove or Harthmere anchor falls inside the band", () => {
    for (const [name, pos] of Object.entries(CH1_ANCHORS)) {
      assert.equal(
        isInsideCh1ElsewhenBand(pos as never),
        false,
        `${name} is inside the unreachable dungeon band`
      );
    }
  });

  it("refuses admission without an active run for that exact slot", () => {
    const desert = CH1_ELSEWHEN_SLOTS[0];
    const winter = CH1_ELSEWHEN_SLOTS[1];

    const noRun = ch1AdmitToElsewhen({ position: [...desert.arrival] });
    assert.equal(noRun.allowed, false);

    const wrongRun = ch1AdmitToElsewhen({
      position: [...desert.arrival],
      activeDungeonRunId: "ch1_dungeon_winter",
    });
    assert.equal(wrongRun.allowed, false);

    const ok = ch1AdmitToElsewhen({
      position: [...desert.arrival],
      activeDungeonRunId: "ch1_dungeon_desert",
    });
    assert.equal(ok.allowed, true);

    const inGap = ch1AdmitToElsewhen({
      position: [2600, 64, 0],
      activeDungeonRunId: "ch1_dungeon_desert",
    });
    assert.equal(inGap.allowed, false);

    // Slots must not overlap.
    assert.notEqual(
      ch1ElsewhenSlotAt(desert.arrival)?.dungeonId,
      ch1ElsewhenSlotAt(winter.arrival)?.dungeonId
    );
  });

  it("assigns stable, disjoint terrain entity ids", () => {
    const a = ch1ElsewhenTerrainEntityIdForShard(82, 0, 0);
    const b = ch1ElsewhenTerrainEntityIdForShard(82, 0, 1);
    assert.ok(a && b && a !== b);
    assert.equal(ch1ElsewhenTerrainEntityIdForShard(82, 0, 0), a, "stable");
    assert.equal(ch1ElsewhenTerrainEntityIdForShard(0, 0, 0), undefined);
    // Disjoint from the Harthmere extension band.
    assert.ok(a! >= 8_810_000_002_000_000);
  });
});

// ---------------------------------------------------------------------------

describe("ch1 - quests and acts", () => {
  it("has a valid act structure", () => {
    assert.deepEqual(ch1ValidateActStructure(), []);
  });

  it("covers all six memory-reconstruction acts", () => {
    for (let act = 1; act <= CH1_ACT_COUNT; act++) {
      assert.ok(ch1QuestsForAct(act).length > 0, `act ${act} is empty`);
      assert.ok(ch1ActCloseQuest(act), `act ${act} has no closing quest`);
    }
  });

  it("every quest id is unique", () => {
    const ids = CH1_QUESTS.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("every referenced fragment, skill, and cutscene exists", () => {
    for (const id of ch1QuestFragmentIds()) {
      assert.ok(ch1Fragment(id), `quest references unknown fragment ${id}`);
    }
    const skillIds = new Set(CH1_LATENT_SKILLS.map((s) => s.id));
    for (const id of ch1QuestLatentSkillIds()) {
      assert.ok(skillIds.has(id as never), `unknown latent skill ${id}`);
    }
    assert.ok(ch1QuestCutsceneIds().length > 0);
  });

  it("gates quests behind the current act", () => {
    const start = [CH1_FLAGS.started];
    const act1 = ch1AvailableQuestIds(start);
    assert.ok(act1.includes("ch1_a1_q01_morning_after"));
    assert.ok(!act1.includes("ch1_a4_q02_thirty_one_seconds"));
    assert.equal(ch1CurrentAct(start), 1);
    assert.equal(ch1CurrentAct([]), 0);
    assert.equal(
      ch1CurrentAct([CH1_FLAGS.started, CH1_FLAGS.act1Complete, CH1_FLAGS.act2Complete]),
      3
    );
  });
});

// ---------------------------------------------------------------------------

describe("ch1 - cast and testimonies", () => {
  it("has exactly twelve testimonies awarding a reconstruction", () => {
    assert.equal(CH1_TESTIMONIES.length, 12);
    assert.equal(new Set(CH1_TESTIMONIES.map((t) => t.id)).size, 12);
    const reward = ch1Fragment(CH1_TESTIMONY_REWARD_FRAGMENT);
    assert.equal(
      reward?.type,
      "reconstruction",
      "the testimony reward must be a reconstruction — the player builds the lie themselves"
    );
  });

  it("testimony completion requires all twelve", () => {
    const all = CH1_TESTIMONIES.map((t) => t.id);
    assert.equal(ch1TestimoniesComplete(all), true);
    assert.equal(ch1TestimoniesComplete(all.slice(1)), false);
  });

  it("cast entity ids are unique and in the reserved 10500 band", () => {
    const ids = Object.values(CH1_NPC_ENTITY_IDS).map(Number);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(Number(ch1NpcEntityId("lou_ardan")), ids[0]);
    for (const member of CH1_NEW_CAST) {
      assert.ok(Number(member.entityId) > 0);
    }
  });

  it("Marrow is a non-combatant", () => {
    const marrow = CH1_NEW_CAST.find((c) => c.key === "marrow");
    assert.equal(marrow?.combatant, false);
  });
});

// ---------------------------------------------------------------------------

describe("ch1 - items and naming discipline", () => {
  it("the Card cannot be dropped or sold", () => {
    const card = CH1_ITEMS.find((i) => i.id === "item_grey_card");
    assert.equal(card?.droppable, false);
    assert.equal(card?.sellable, false);
  });

  it("the Card renames only at the consolidation", () => {
    assert.equal(ch1ItemDisplayName("item_grey_card", []), "Grey Card");
    assert.equal(
      ch1ItemDisplayName("item_grey_card", [CH1_FLAGS.act6TruthKnown]),
      "Custodian Key 7"
    );
    assert.notEqual(
      ch1ItemDescription("item_grey_card", []),
      ch1ItemDescription("item_grey_card", [CH1_FLAGS.act6TruthKnown])
    );
  });

  it("the two compounds are indistinguishable before Act 6", () => {
    const a = ch1ItemDisplayName("item_ch1_compound_a", []);
    const b = ch1ItemDisplayName("item_ch1_compound_b", []);
    assert.notEqual(a, "Stillwater");
    assert.notEqual(b, "Riverbed");
    assert.equal(
      ch1ItemDisplayName("item_ch1_compound_b", [CH1_FLAGS.act6TruthKnown]),
      "Riverbed"
    );
  });

  it("no pre-Act-6 client copy leaks the twist", () => {
    // Journal §0: quest IDs and item names leak in the network tab.
    const noFlags: string[] = [];
    for (const item of CH1_ITEMS) {
      const name = ch1ItemDisplayName(item.id, noFlags)!;
      const desc = ch1ItemDescription(item.id, noFlags)!;
      assert.deepEqual(
        ch1ForbiddenSubstrings(name),
        [],
        `item name "${name}" leaks the twist`
      );
      assert.deepEqual(
        ch1ForbiddenSubstrings(desc),
        [],
        `item description for ${item.id} leaks the twist`
      );
    }
    for (const frag of CH1_FRAGMENTS) {
      if (frag.act >= 6) {
        continue;
      }
      assert.deepEqual(
        ch1ForbiddenSubstrings(frag.title),
        [],
        `fragment title "${frag.title}" leaks the twist`
      );
      assert.deepEqual(
        ch1ForbiddenSubstrings(frag.body),
        [],
        `fragment body for ${frag.id} leaks the twist`
      );
    }
    for (const quest of CH1_QUESTS) {
      if (quest.act >= 6) {
        continue;
      }
      assert.deepEqual(
        ch1ForbiddenSubstrings(quest.id),
        [],
        `quest id ${quest.id} leaks the twist`
      );
      assert.deepEqual(
        ch1ForbiddenSubstrings(quest.title),
        [],
        `quest title "${quest.title}" leaks the twist`
      );
      assert.deepEqual(
        ch1ForbiddenSubstrings(quest.summary),
        [],
        `quest summary for ${quest.id} leaks the twist`
      );
      for (const step of quest.steps) {
        assert.deepEqual(
          ch1ForbiddenSubstrings(step.objective),
          [],
          `step objective in ${quest.id}/${step.id} leaks the twist`
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------

describe("ch1 - chapter progression", () => {
  it("blocks gate entry when under-provisioned", () => {
    let state = ch1InitialPlayerState();
    state = ch1SetFlag(state, CH1_FLAGS.started);
    state = ch1SetFlag(state, CH1_FLAGS.act2Complete);
    const result = ch1EnterGate({
      state,
      gateId: "ch1_gate_desert",
      carried: { water: 1 },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "under-provisioned");
      assert.ok((result.provisioning?.missing.length ?? 0) > 0);
    }
  });

  it("admits a fully provisioned player to the Elsewhen arrival", () => {
    let state = ch1InitialPlayerState();
    state = ch1SetFlag(state, CH1_FLAGS.started);
    state = ch1SetFlag(state, CH1_FLAGS.act2Complete);
    const carried: Record<string, number> = {};
    for (const r of CH1_PROVISIONING[0].requirements) {
      carried[r.key] = r.quantity;
    }
    const result = ch1EnterGate({ state, gateId: "ch1_gate_desert", carried });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.dungeonId, "ch1_dungeon_desert");
      assert.ok(
        isInsideCh1ElsewhenBand(result.arrival as never),
        "arrival must be inside the unreachable band"
      );
    }
  });

  it("refuses to open a gate that is not open yet", () => {
    const state = ch1SetFlag(ch1InitialPlayerState(), CH1_FLAGS.started);
    const carried: Record<string, number> = {};
    for (const r of CH1_PROVISIONING[0].requirements) {
      carried[r.key] = r.quantity;
    }
    const result = ch1EnterGate({ state, gateId: "ch1_gate_desert", carried });
    assert.equal(result.ok, false);
  });

  it("will not let a player leave without the required retrievals", () => {
    const state = {
      ...ch1InitialPlayerState(),
      activeDungeonRunId: "ch1_dungeon_desert",
      activeRunStartedMs: 0,
    };
    const short = ch1ExitGate({ state, carriedOut: ["item_first_grain"], nowMs: 1000 });
    assert.equal(short.ok, false);

    const full = ch1ExitGate({
      state,
      carriedOut: ["item_first_grain", "npc_iris_fen"],
      nowMs: 90 * 60 * 1000,
    });
    assert.equal(full.ok, true);
    if (full.ok) {
      assert.ok(
        full.groveElapsedMs > 90 * 60 * 1000,
        "time inside must cost more time outside"
      );
      assert.ok(full.completionFlags.includes(CH1_FLAGS.irisRescued));
      assert.ok(full.completionFlags.includes(CH1_FLAGS.hasFirstGrain));
      // Exiting the dungeon must NOT close the act. The act closes on "Three
      // Days" — coming back out, Jackie reaching for the player, the player
      // flinching. Setting act3Complete here advanced the chapter the instant
      // the player stepped through the aperture and stranded both the dungeon
      // quest and the closing scene in an act they could no longer enter.
      // Caught by ch1_e2e_playthrough.test.ts.
      assert.ok(
        !full.completionFlags.includes(CH1_FLAGS.act3Complete),
        "the dungeon must not close its own act"
      );
    }
  });

  it("has three endings and marks none as canon", () => {
    assert.equal(CH1_ENDING_DEFS.length, 3);
    for (const ending of CH1_ENDING_DEFS) {
      assert.ok(ending.immediateCost.length > 0, `${ending.id} has no cost`);
      assert.ok(ending.chapter2.length > 0);
    }
    const state = ch1ChooseEnding(ch1InitialPlayerState(), "contain");
    assert.equal(state.ending, "contain");
    assert.ok(state.flags.includes(CH1_FLAGS.complete));
    assert.throws(() =>
      ch1ChooseEnding(ch1InitialPlayerState(), "heroic" as never)
    );
  });
});

// ---------------------------------------------------------------------------

describe("ch1 - engine authority contracts", () => {
  it("passes every ECS / Anima / Gaia contract", () => {
    assert.deepEqual(ch1ValidateEngineContracts(), []);
  });
});
