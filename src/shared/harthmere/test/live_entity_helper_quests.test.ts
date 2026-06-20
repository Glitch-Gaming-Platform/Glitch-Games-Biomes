/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID,
  LIVE_ENTITY_HELPER_QUEST_ITEM_COPY,
  LIVE_ENTITY_HELPER_QUEST_DEFINITIONS,
  LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS,
  LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA,
  canCompleteLiveEntityHelperQuest,
  getLiveEntityHelperQuestForEntity,
  isLiveEntityHelperMuckBossSpawnMarker,
  isLiveEntityHelperPositionInMuckBreachArea,
  isLiveEntityHelperQuestExcludedPosition,
  isLiveEntityHelperQuestTargetMarkerGrounded,
  isLiveEntityHelperQuestEligibleEntity,
  liveEntityHelperActiveQuestTargetMarkerIds,
  liveEntityHelperQuestDeltas,
  liveEntityHelperQuestEvidenceSinceBaseline,
  liveEntityHelperQuestKindForEntity,
  liveEntityHelperQuestObjectiveBaseline,
  liveEntityHelperQuestObjectiveMet,
  liveEntityHelperQuestOfferedForEntity,
  liveEntityHelperQuestRewardText,
  liveEntityHelperQuestTargetMarkerForKind,
  liveEntityHelperQuestTargetMarkerIdForKind,
  liveEntityHelperPrimaryActiveQuestTargetMarkerId,
  LIVE_ENTITY_HELPER_QUEST_OFFER_RATE_PERCENT,
} from "../live_entity_helper_quests";

describe("live_entity_helper_quests - eligibility", () => {
  it("allows live robots and people outside the Grove and shifted Harthmere", () => {
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity({
        entityId: "robot-outside",
        position: [1000, 70, 600],
        hasRobotComponent: true,
      }),
      true
    );
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity({
        entityId: "person-outside",
        position: [1000, 70, 600],
        hasAppearanceComponent: true,
        hasPlayerStatus: true,
      }),
      true
    );
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity({
        entityId: "npc-person-outside",
        position: [1000, 70, 600],
        hasAppearanceComponent: true,
        hasNpcMetadata: true,
      }),
      true
    );
  });

  it("allows robot-labeled live entities outside excluded towns when robot metadata is missing", () => {
    const labels = [
      "little stupid robot",
      "Mucked Restoro Bot",
      "Archive Sentential",
    ] as const;

    for (const label of labels) {
      const context = {
        entityId: label.toLowerCase().replace(/\s+/g, "-"),
        label,
        position: [232, 54, -506],
      } as const;

      assert.equal(isLiveEntityHelperQuestEligibleEntity(context), true);

      const quest = getLiveEntityHelperQuestForEntity(context);
      assert.ok(quest);
      assert.match(quest.buttonName, /^Help with /);
    }
  });

  it("allows talkable live entities outside excluded towns when ECS actor metadata is missing", () => {
    const context = {
      entityId: "frogberry",
      label: "Frogberry",
      position: [232, 54, -506],
      hasTalkableDialog: true,
    } as const;

    assert.equal(isLiveEntityHelperQuestEligibleEntity(context), true);

    const quest = getLiveEntityHelperQuestForEntity(context);
    assert.ok(quest);
    assert.match(quest.buttonName, /^Help with /);
  });

  it("excludes Grove, Harthmere, iced, and non-live entities", () => {
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity({
        entityId: "grove-robot",
        position: [501, 70, -132],
        hasRobotComponent: true,
      }),
      false
    );
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity({
        entityId: "harthmere-person",
        position: [904, 70, -160],
        hasAppearanceComponent: true,
        hasNpcMetadata: true,
      }),
      false
    );
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity({
        entityId: "iced-person",
        position: [1000, 70, 600],
        hasAppearanceComponent: true,
        hasNpcMetadata: true,
        iced: true,
      }),
      false
    );
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity({
        entityId: "plain-object",
        position: [1000, 70, 600],
      }),
      false
    );
  });

  it("excludes any entity that already owns a quest (quest_giver component)", () => {
    // A wandering NPC well outside the Grove/Harthmere boxes is normally
    // eligible...
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity({
        entityId: "wilds-local",
        position: [1000, 70, 600],
        hasAppearanceComponent: true,
        hasNpcMetadata: true,
      }),
      true
    );
    // ...but the same entity carrying an authored quest_giver component (e.g.
    // Billy Rhodes, a town giver, or a shop owner) must never hand out a generic
    // helper quest, even if it wanders outside the exclusion bounds.
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity({
        entityId: "billy-rhodes",
        label: "Billy Rhodes",
        position: [1000, 70, 600],
        hasAppearanceComponent: true,
        hasNpcMetadata: true,
        hasQuestGiverComponent: true,
      }),
      false
    );
  });
});

describe("live_entity_helper_quests - item copy", () => {
  it("has production-facing item names and server descriptions for every quest item", () => {
    const banned =
      /\b(debug|developer|local[- ]?dev|server|backend|payload|test|placeholder|todo)\b/i;
    const rawIdentifier = /[_]|[a-z][A-Z]/;
    const questItemIds = new Set<string>();
    for (const quest of Object.values(
      LIVE_ENTITY_HELPER_QUEST_DEFINITIONS
    )) {
      for (const item of quest.requirements.items ?? []) {
        questItemIds.add(item.itemId);
        assert.equal(
          item.itemName,
          LIVE_ENTITY_HELPER_QUEST_ITEM_COPY[item.itemId]?.displayName
        );
      }
      for (const item of quest.rewards.items) {
        questItemIds.add(item.itemId);
        assert.equal(
          item.itemName,
          LIVE_ENTITY_HELPER_QUEST_ITEM_COPY[item.itemId]?.displayName
        );
      }
    }

    for (const itemId of questItemIds) {
      const copy = LIVE_ENTITY_HELPER_QUEST_ITEM_COPY[itemId];
      assert.ok(copy, `${itemId} needs server item copy`);
      assert.equal(
        rawIdentifier.test(copy.displayName),
        false,
        `${itemId} display name should not look like an id`
      );
      assert.equal(
        rawIdentifier.test(copy.description),
        false,
        `${itemId} description should not expose raw ids`
      );
      assert.equal(
        banned.test(copy.displayName),
        false,
        `${itemId} display name should not expose implementation words`
      );
      assert.equal(
        banned.test(copy.description),
        false,
        `${itemId} description should not expose implementation words`
      );
      assert.ok(
        copy.description.length >= 24,
        `${itemId} needs a real item description`
      );
    }
  });

  it("builds player-facing reward text without raw item ids or implementation wording", () => {
    for (const quest of Object.values(
      LIVE_ENTITY_HELPER_QUEST_DEFINITIONS
    )) {
      const rewardText = liveEntityHelperQuestRewardText(quest);
      assert.ok(rewardText.startsWith("Reward: "));
      assert.ok(rewardText.includes(`${quest.rewards.baseXp} XP`));
      assert.equal(
        /raw_exotic_matter|stabilized_exotic_matter|repair_voucher|minor_healing_salve|debug|server|backend/i.test(
          rewardText
        ),
        false
      );
    }
  });
});

describe("live_entity_helper_quests - assignment", () => {
  it("assigns one stable random quest family per eligible entity", () => {
    const first = liveEntityHelperQuestKindForEntity("entity-42", "Loamf");
    const second = liveEntityHelperQuestKindForEntity("entity-42", "Loamf");
    assert.equal(first, second);

    const seen = new Set<string>();
    for (let index = 0; index < 80; index += 1) {
      seen.add(
        liveEntityHelperQuestKindForEntity(`entity-${index}`, "helper")
      );
    }
    assert.deepEqual([...seen].sort(), [
      "exotic_matter",
      "food_water",
      "hard_boss",
    ]);

    const quest = getLiveEntityHelperQuestForEntity({
      entityId: "entity-42",
      label: "Loamf",
      position: [1000, 70, 600],
      isRobotLike: true,
    });
    assert.ok(quest);
    assert.ok(quest.questId.includes(`:${quest.kind}`));
  });
});

describe("live_entity_helper_quests - completion gates", () => {
  it("requires actual Raw Exotic Matter before the exotic quest can complete", () => {
    const quest = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS.exotic_matter;
    const missing = canCompleteLiveEntityHelperQuest(quest, {
      inventory: { raw_exotic_matter: 1 },
    });
    assert.equal(missing.ok, false);
    assert.deepEqual(missing.missing, ["Raw Exotic Matter 1/2"]);

    const ready = canCompleteLiveEntityHelperQuest(quest, {
      inventory: { raw_exotic_matter: 2 },
    });
    assert.equal(ready.ok, true);
    const deltas = liveEntityHelperQuestDeltas(quest);
    assert.deepEqual(deltas.consumedItems, { raw_exotic_matter: 2 });
    assert.deepEqual(deltas.rewardItems, {
      stabilized_exotic_matter: 1,
      mana_crystal_shard: 1,
    });
    assert.equal(deltas.xp.difficulty, "hard");
  });

  it("requires both food and water before the supply quest can complete", () => {
    const quest = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS.food_water;
    const missing = canCompleteLiveEntityHelperQuest(quest, {
      inventory: { road_ration: 3, clean_water: 1 },
    });
    assert.equal(missing.ok, false);
    assert.deepEqual(missing.missing, ["Clean Water 1/2"]);

    const ready = canCompleteLiveEntityHelperQuest(quest, {
      inventory: { road_ration: 3, clean_water: 2 },
    });
    assert.equal(ready.ok, true);
    const deltas = liveEntityHelperQuestDeltas(quest);
    assert.deepEqual(deltas.consumedItems, {
      road_ration: 3,
      clean_water: 2,
    });
    assert.deepEqual(deltas.rewardItems, {
      minor_healing_salve: 2,
      repair_voucher: 1,
    });
    assert.equal(deltas.xp.difficulty, "normal");
  });

  it("requires a defeated hard boss, not just damage, before the boss quest can complete", () => {
    const quest = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS.hard_boss;
    const damageOnly = canCompleteLiveEntityHelperQuest(quest, {
      hardBossDefeats: 0,
    });
    assert.equal(damageOnly.ok, false);
    assert.deepEqual(damageOnly.missing, ["Muck-Scarred Helix defeated 0/1"]);

    const ready = canCompleteLiveEntityHelperQuest(quest, {
      hardBossDefeats: 1,
    });
    assert.equal(ready.ok, true);
    const deltas = liveEntityHelperQuestDeltas(quest);
    assert.deepEqual(deltas.consumedItems, {});
    assert.deepEqual(deltas.rewardItems, {
      muck_boss_trophy: 1,
      stabilized_exotic_matter: 1,
      repair_voucher: 2,
    });
    assert.equal(deltas.xp.difficulty, "elite");
  });
});

describe("live_entity_helper_quests - accept-time baseline (no instant-complete)", () => {
  it("does NOT count items the player already held when the quest was accepted", () => {
    const quest = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS.food_water;

    // Player walks up already carrying the default 5 Road Rations + 2 Clean
    // Water. Pre-fix, completionEvidence read these raw and the quest was
    // instantly "done" — the marker flipped straight back to the giver.
    const current = { inventory: { road_ration: 5, clean_water: 2 } };
    const baseline = liveEntityHelperQuestObjectiveBaseline(quest, current);

    assert.deepEqual(baseline.inventory, { road_ration: 5, clean_water: 2 });

    // With the baseline taken out, NOTHING has been collected yet, so the
    // objective is not met on accept.
    const onAccept = liveEntityHelperQuestEvidenceSinceBaseline(
      current,
      baseline
    );
    assert.equal(liveEntityHelperQuestObjectiveMet("food_water", onAccept), false);
  });

  it("completes only once NEW items are collected beyond the baseline", () => {
    const quest = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS.food_water;
    const baseline = liveEntityHelperQuestObjectiveBaseline(quest, {
      inventory: { road_ration: 5 },
    });

    // Gathered exactly the required amounts AFTER accepting.
    const afterGathering = {
      inventory: { road_ration: 5 + 3, clean_water: 2 },
    };
    const progress = liveEntityHelperQuestEvidenceSinceBaseline(
      afterGathering,
      baseline
    );
    assert.deepEqual(progress.inventory, { road_ration: 3, clean_water: 2 });
    assert.equal(
      liveEntityHelperQuestObjectiveMet("food_water", progress),
      true
    );
  });

  it("requires a FRESH boss kill after accepting, not a previously-recorded one", () => {
    const quest = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS.hard_boss;
    // Boss was already dead/credited at accept time.
    const baseline = liveEntityHelperQuestObjectiveBaseline(quest, {
      hardBossDefeats: 1,
    });
    assert.equal(baseline.hardBossDefeats, 1);

    const stillOnlyOldKill = liveEntityHelperQuestEvidenceSinceBaseline(
      { hardBossDefeats: 1 },
      baseline
    );
    assert.equal(
      liveEntityHelperQuestObjectiveMet("hard_boss", stillOnlyOldKill),
      false
    );

    const freshKill = liveEntityHelperQuestEvidenceSinceBaseline(
      { hardBossDefeats: 2 },
      baseline
    );
    assert.equal(
      liveEntityHelperQuestObjectiveMet("hard_boss", freshKill),
      true
    );
  });

  it("treats a missing baseline as count-everything (old in-flight records)", () => {
    const evidence = liveEntityHelperQuestEvidenceSinceBaseline(
      { inventory: { raw_exotic_matter: 2 } },
      undefined
    );
    assert.equal(
      liveEntityHelperQuestObjectiveMet("exotic_matter", evidence),
      true
    );
  });
});

describe("live_entity_helper_quests - quest offer rate (~70%)", () => {
  it("is a stable per-entity decision (same entity, same answer)", () => {
    for (const [id, label] of [
      ["wild-helper", "Frogberry"],
      ["little-stupid-robot", "little stupid robot"],
    ] as const) {
      assert.equal(
        liveEntityHelperQuestOfferedForEntity(id, label),
        liveEntityHelperQuestOfferedForEntity(id, label)
      );
    }
  });

  it("offers a quest to roughly the configured share of eligible entities", () => {
    let offered = 0;
    const total = 4000;
    for (let index = 0; index < total; index += 1) {
      if (liveEntityHelperQuestOfferedForEntity(`ent-${index}`, `NPC ${index}`)) {
        offered += 1;
      }
    }
    const rate = (offered / total) * 100;
    // Within ~5 points of the configured rate (70%).
    assert.ok(
      Math.abs(rate - LIVE_ENTITY_HELPER_QUEST_OFFER_RATE_PERCENT) <= 5,
      `offer rate ${rate.toFixed(1)}% should be near ${LIVE_ENTITY_HELPER_QUEST_OFFER_RATE_PERCENT}%`
    );
    // And it is neither always-on nor always-off.
    assert.ok(offered > 0 && offered < total);
  });
});

describe("live_entity_helper_quests - target markers and encounter spawning", () => {
  it("maps each helper quest family to a concrete active target coordinate", () => {
    assert.equal(
      liveEntityHelperQuestTargetMarkerIdForKind("exotic_matter"),
      "live_helper_old_well_exotic_residue"
    );
    assert.equal(
      liveEntityHelperQuestTargetMarkerIdForKind("food_water"),
      "live_helper_bluewater_supply_route"
    );
    assert.equal(
      liveEntityHelperQuestTargetMarkerIdForKind("hard_boss"),
      LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID
    );

    for (const marker of LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS) {
      assert.equal(
        isLiveEntityHelperQuestTargetMarkerGrounded(marker),
        true,
        `${marker.id} should sit on its authored ground height`
      );
    }
  });

  it("spawns the hard boss only for an active hard-boss helper quest", () => {
    assert.deepEqual(
      [...liveEntityHelperActiveQuestTargetMarkerIds({})],
      [],
      "no helper quest means no helper target or boss marker"
    );
    assert.equal(
      liveEntityHelperPrimaryActiveQuestTargetMarkerId({}),
      undefined
    );

    const foodOnly = {
      "live-helper:entity-1:food_water": {
        kind: "food_water" as const,
        at: 100,
      },
    };
    assert.equal(
      liveEntityHelperActiveQuestTargetMarkerIds(foodOnly).has(
        LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID
      ),
      false
    );

    const hardBossActive = {
      ...foodOnly,
      "live-helper:entity-2:hard_boss": {
        kind: "hard_boss" as const,
        at: 90,
      },
    };
    assert.equal(
      liveEntityHelperActiveQuestTargetMarkerIds(hardBossActive).has(
        LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID
      ),
      true
    );
    assert.equal(
      liveEntityHelperPrimaryActiveQuestTargetMarkerId(hardBossActive),
      LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID,
      "boss quests take map priority while active"
    );
  });

  it("places the hard boss in a Muck area outside the Grove and Harthmere", () => {
    const marker = liveEntityHelperQuestTargetMarkerForKind("hard_boss");
    assert.ok(marker, "hard boss marker should exist");
    assert.equal(isLiveEntityHelperMuckBossSpawnMarker(marker), true);
    assert.equal(
      isLiveEntityHelperPositionInMuckBreachArea(marker?.position),
      true
    );
    assert.equal(
      isLiveEntityHelperQuestExcludedPosition(marker?.position),
      false,
      "boss Muck breach should not be inside the Grove or shifted Harthmere exclusion"
    );
    assert.equal(
      marker?.areaId,
      LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA.id
    );
  });

  it("keeps player-facing copy production-ready", () => {
    const banned = /\b(debug|developer|local[- ]?dev|test|placeholder|todo)\b/i;
    for (const quest of Object.values(
      LIVE_ENTITY_HELPER_QUEST_DEFINITIONS
    )) {
      for (const text of [
        quest.title,
        quest.buttonName,
        quest.offerText,
        quest.activeText,
        quest.readyText,
        quest.completionText,
        quest.taskHint,
      ]) {
        assert.equal(
          banned.test(text),
          false,
          `${quest.kind} text should not expose development wording: ${text}`
        );
      }
    }
  });
});
