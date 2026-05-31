/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1,
  LIVE_ENTITY_HELPER_QUEST_ITEM_COPY_V1,
  LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1,
  LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS_V1,
  LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA_V1,
  canCompleteLiveEntityHelperQuestV1,
  getLiveEntityHelperQuestForEntityV1,
  isLiveEntityHelperMuckBossSpawnMarkerV1,
  isLiveEntityHelperPositionInMuckBreachAreaV1,
  isLiveEntityHelperQuestExcludedPositionV1,
  isLiveEntityHelperQuestTargetMarkerGroundedV1,
  isLiveEntityHelperQuestEligibleEntityV1,
  liveEntityHelperActiveQuestTargetMarkerIdsV1,
  liveEntityHelperQuestDeltasV1,
  liveEntityHelperQuestKindForEntityV1,
  liveEntityHelperQuestRewardTextV1,
  liveEntityHelperQuestTargetMarkerForKindV1,
  liveEntityHelperQuestTargetMarkerIdForKindV1,
  liveEntityHelperPrimaryActiveQuestTargetMarkerIdV1,
} from "../live_entity_helper_quests_v1";

describe("live_entity_helper_quests_v1 - eligibility", () => {
  it("allows live robots and people outside the Grove and shifted Harthmere", () => {
    assert.equal(
      isLiveEntityHelperQuestEligibleEntityV1({
        entityId: "robot-outside",
        position: [1000, 70, 600],
        hasRobotComponent: true,
      }),
      true
    );
    assert.equal(
      isLiveEntityHelperQuestEligibleEntityV1({
        entityId: "person-outside",
        position: [1000, 70, 600],
        hasAppearanceComponent: true,
        hasPlayerStatus: true,
      }),
      true
    );
    assert.equal(
      isLiveEntityHelperQuestEligibleEntityV1({
        entityId: "npc-person-outside",
        position: [1000, 70, 600],
        hasAppearanceComponent: true,
        hasNpcMetadata: true,
      }),
      true
    );
  });

  it("allows robot-labeled live entities outside excluded towns when robot metadata is missing", () => {
    const context = {
      entityId: "little-stupid-robot",
      label: "little stupid robot",
      position: [232, 54, -506],
    } as const;

    assert.equal(isLiveEntityHelperQuestEligibleEntityV1(context), true);

    const quest = getLiveEntityHelperQuestForEntityV1(context);
    assert.ok(quest);
    assert.match(quest.buttonName, /^Help with /);
  });

  it("allows talkable live entities outside excluded towns when ECS actor metadata is missing", () => {
    const context = {
      entityId: "frogberry",
      label: "Frogberry",
      position: [232, 54, -506],
      hasTalkableDialog: true,
    } as const;

    assert.equal(isLiveEntityHelperQuestEligibleEntityV1(context), true);

    const quest = getLiveEntityHelperQuestForEntityV1(context);
    assert.ok(quest);
    assert.match(quest.buttonName, /^Help with /);
  });

  it("excludes Grove, Harthmere, iced, and non-live entities", () => {
    assert.equal(
      isLiveEntityHelperQuestEligibleEntityV1({
        entityId: "grove-robot",
        position: [501, 70, -132],
        hasRobotComponent: true,
      }),
      false
    );
    assert.equal(
      isLiveEntityHelperQuestEligibleEntityV1({
        entityId: "harthmere-person",
        position: [904, 70, -160],
        hasAppearanceComponent: true,
        hasNpcMetadata: true,
      }),
      false
    );
    assert.equal(
      isLiveEntityHelperQuestEligibleEntityV1({
        entityId: "iced-person",
        position: [1000, 70, 600],
        hasAppearanceComponent: true,
        hasNpcMetadata: true,
        iced: true,
      }),
      false
    );
    assert.equal(
      isLiveEntityHelperQuestEligibleEntityV1({
        entityId: "plain-object",
        position: [1000, 70, 600],
      }),
      false
    );
  });
});

describe("live_entity_helper_quests_v1 - item copy", () => {
  it("has production-facing item names and server descriptions for every quest item", () => {
    const banned =
      /\b(debug|developer|local[- ]?dev|server|backend|payload|test|placeholder|todo)\b/i;
    const rawIdentifier = /[_]|[a-z][A-Z]/;
    const questItemIds = new Set<string>();
    for (const quest of Object.values(
      LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1
    )) {
      for (const item of quest.requirements.items ?? []) {
        questItemIds.add(item.itemId);
        assert.equal(
          item.itemName,
          LIVE_ENTITY_HELPER_QUEST_ITEM_COPY_V1[item.itemId]?.displayName
        );
      }
      for (const item of quest.rewards.items) {
        questItemIds.add(item.itemId);
        assert.equal(
          item.itemName,
          LIVE_ENTITY_HELPER_QUEST_ITEM_COPY_V1[item.itemId]?.displayName
        );
      }
    }

    for (const itemId of questItemIds) {
      const copy = LIVE_ENTITY_HELPER_QUEST_ITEM_COPY_V1[itemId];
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
      LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1
    )) {
      const rewardText = liveEntityHelperQuestRewardTextV1(quest);
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

describe("live_entity_helper_quests_v1 - assignment", () => {
  it("assigns one stable random quest family per eligible entity", () => {
    const first = liveEntityHelperQuestKindForEntityV1("entity-42", "Loamf");
    const second = liveEntityHelperQuestKindForEntityV1("entity-42", "Loamf");
    assert.equal(first, second);

    const seen = new Set<string>();
    for (let index = 0; index < 80; index += 1) {
      seen.add(
        liveEntityHelperQuestKindForEntityV1(`entity-${index}`, "helper")
      );
    }
    assert.deepEqual([...seen].sort(), [
      "exotic_matter",
      "food_water",
      "hard_boss",
    ]);

    const quest = getLiveEntityHelperQuestForEntityV1({
      entityId: "entity-42",
      label: "Loamf",
      position: [1000, 70, 600],
      isRobotLike: true,
    });
    assert.ok(quest);
    assert.ok(quest.questId.includes(`:${quest.kind}`));
  });
});

describe("live_entity_helper_quests_v1 - completion gates", () => {
  it("requires actual Raw Exotic Matter before the exotic quest can complete", () => {
    const quest = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1.exotic_matter;
    const missing = canCompleteLiveEntityHelperQuestV1(quest, {
      inventory: { raw_exotic_matter: 1 },
    });
    assert.equal(missing.ok, false);
    assert.deepEqual(missing.missing, ["Raw Exotic Matter 1/2"]);

    const ready = canCompleteLiveEntityHelperQuestV1(quest, {
      inventory: { raw_exotic_matter: 2 },
    });
    assert.equal(ready.ok, true);
    const deltas = liveEntityHelperQuestDeltasV1(quest);
    assert.deepEqual(deltas.consumedItems, { raw_exotic_matter: 2 });
    assert.deepEqual(deltas.rewardItems, {
      stabilized_exotic_matter: 1,
      mana_crystal_shard: 1,
    });
    assert.equal(deltas.xp.difficulty, "hard");
  });

  it("requires both food and water before the supply quest can complete", () => {
    const quest = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1.food_water;
    const missing = canCompleteLiveEntityHelperQuestV1(quest, {
      inventory: { road_ration: 3, clean_water: 1 },
    });
    assert.equal(missing.ok, false);
    assert.deepEqual(missing.missing, ["Clean Water 1/2"]);

    const ready = canCompleteLiveEntityHelperQuestV1(quest, {
      inventory: { road_ration: 3, clean_water: 2 },
    });
    assert.equal(ready.ok, true);
    const deltas = liveEntityHelperQuestDeltasV1(quest);
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
    const quest = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1.hard_boss;
    const damageOnly = canCompleteLiveEntityHelperQuestV1(quest, {
      hardBossDefeats: 0,
    });
    assert.equal(damageOnly.ok, false);
    assert.deepEqual(damageOnly.missing, ["Muck-Scarred Helix defeated 0/1"]);

    const ready = canCompleteLiveEntityHelperQuestV1(quest, {
      hardBossDefeats: 1,
    });
    assert.equal(ready.ok, true);
    const deltas = liveEntityHelperQuestDeltasV1(quest);
    assert.deepEqual(deltas.consumedItems, {});
    assert.deepEqual(deltas.rewardItems, {
      muck_boss_trophy: 1,
      stabilized_exotic_matter: 1,
      repair_voucher: 2,
    });
    assert.equal(deltas.xp.difficulty, "elite");
  });
});

describe("live_entity_helper_quests_v1 - target markers and encounter spawning", () => {
  it("maps each helper quest family to a concrete active target coordinate", () => {
    assert.equal(
      liveEntityHelperQuestTargetMarkerIdForKindV1("exotic_matter"),
      "live_helper_old_well_exotic_residue"
    );
    assert.equal(
      liveEntityHelperQuestTargetMarkerIdForKindV1("food_water"),
      "live_helper_bluewater_supply_route"
    );
    assert.equal(
      liveEntityHelperQuestTargetMarkerIdForKindV1("hard_boss"),
      LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1
    );

    for (const marker of LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS_V1) {
      assert.equal(
        isLiveEntityHelperQuestTargetMarkerGroundedV1(marker),
        true,
        `${marker.id} should sit on its authored ground height`
      );
    }
  });

  it("spawns the hard boss only for an active hard-boss helper quest", () => {
    assert.deepEqual(
      [...liveEntityHelperActiveQuestTargetMarkerIdsV1({})],
      [],
      "no helper quest means no helper target or boss marker"
    );
    assert.equal(
      liveEntityHelperPrimaryActiveQuestTargetMarkerIdV1({}),
      undefined
    );

    const foodOnly = {
      "live-helper:entity-1:food_water": {
        kind: "food_water" as const,
        at: 100,
      },
    };
    assert.equal(
      liveEntityHelperActiveQuestTargetMarkerIdsV1(foodOnly).has(
        LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1
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
      liveEntityHelperActiveQuestTargetMarkerIdsV1(hardBossActive).has(
        LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1
      ),
      true
    );
    assert.equal(
      liveEntityHelperPrimaryActiveQuestTargetMarkerIdV1(hardBossActive),
      LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1,
      "boss quests take map priority while active"
    );
  });

  it("places the hard boss in a Muck area outside the Grove and Harthmere", () => {
    const marker = liveEntityHelperQuestTargetMarkerForKindV1("hard_boss");
    assert.ok(marker, "hard boss marker should exist");
    assert.equal(isLiveEntityHelperMuckBossSpawnMarkerV1(marker), true);
    assert.equal(
      isLiveEntityHelperPositionInMuckBreachAreaV1(marker?.position),
      true
    );
    assert.equal(
      isLiveEntityHelperQuestExcludedPositionV1(marker?.position),
      false,
      "boss Muck breach should not be inside the Grove or shifted Harthmere exclusion"
    );
    assert.equal(
      marker?.areaId,
      LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA_V1.id
    );
  });

  it("keeps player-facing copy production-ready", () => {
    const banned = /\b(debug|developer|local[- ]?dev|test|placeholder|todo)\b/i;
    for (const quest of Object.values(
      LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1
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
