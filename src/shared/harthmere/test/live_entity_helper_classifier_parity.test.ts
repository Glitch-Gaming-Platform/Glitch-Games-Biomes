/// <reference types="mocha" />
/// <reference types="node" />

// current: parity tests for the live-entity helper-quest classifier and the
// talk system. The bug we're guarding against: an entity that the talk
// system accepts (opens the conversation, shows a label and default
// dialog) but the helper-quest classifier rejects, so the "Help with…"
// option silently disappears. Frogberry and "little stupid robot" are the
// canonical screenshot examples.
//
// These tests also cover the current exclusions that go the OTHER direction:
// muck monsters and the Jobs Board must NOT be quest givers, even though
// they have labels and may have default dialogs.

import assert from "assert";
import {
  getLiveEntityHelperQuestForEntity,
  isLiveEntityHelperLabelJobsBoard,
  isLiveEntityHelperLabelMuckMonster,
  isLiveEntityHelperQuestEligibleEntity,
  type LiveEntityHelperQuestEntityContext,
} from "../live_entity_helper_quests";

// Outside both Grove (300<x<650, -360<z<-40) and shifted Harthmere
// (704<x<1280, -512<z<192).
const OUTSIDE_POSITION: readonly number[] = [232, 54, -506];
const GROVE_POSITION: readonly number[] = [501, 70, -132];
const HARTHMERE_POSITION: readonly number[] = [904, 70, -160];

function ctx(
  overrides: Partial<LiveEntityHelperQuestEntityContext>
): LiveEntityHelperQuestEntityContext {
  return {
    entityId: overrides.entityId ?? "test-entity",
    position: overrides.position ?? OUTSIDE_POSITION,
    ...overrides,
  };
}

describe("live-entity helper classifier — widening (current)", () => {
  it("accepts a Frogberry-style named entity with only default dialog", () => {
    // Mirrors what the talk system accepts via the `hasDefaultDialog`
    // branch: a label, a default_dialog string, no NPC metadata.
    const context = ctx({
      entityId: "frogberry",
      label: "Frogberry",
      hasTalkableDialog: true,
    });
    assert.equal(isLiveEntityHelperQuestEligibleEntity(context), true);
    const quest = getLiveEntityHelperQuestForEntity(context);
    assert.ok(quest, "Frogberry should receive a helper quest");
    assert.match(
      quest!.buttonName,
      /^Help with /,
      "quest must offer a player-facing Help with… button"
    );
  });

  it("accepts a little-stupid-robot-style entity by robot keyword in the label", () => {
    for (const label of [
      "little stupid robot",
      "Mucked Restoro Bot",
      "Archive Sentential",
    ]) {
      const context = ctx({
        entityId: label.toLowerCase().replace(/\s+/g, "-"),
        label,
      });
      assert.equal(isLiveEntityHelperQuestEligibleEntity(context), true);
    }
  });

  it("accepts a robot entity outside the towns whose only signal is a robot ECS component", () => {
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity(
        ctx({
          entityId: "biscuit-robot",
          label: "Sparkplug",
          hasRobotComponent: true,
        })
      ),
      true
    );
  });

  it("accepts a robot entity whose only signal is `isRobotLike` from a biscuit", () => {
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity(
        ctx({
          entityId: "biscuit-only-robot",
          label: "Helix",
          isRobotLike: true,
        })
      ),
      true
    );
  });

  it("accepts a person-like entity with appearance + NPC metadata", () => {
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity(
        ctx({
          entityId: "person",
          label: "Wanderer",
          hasAppearanceComponent: true,
          hasNpcMetadata: true,
        })
      ),
      true
    );
  });
});

describe("live-entity helper classifier — exclusions (current)", () => {
  it("rejects Grove and Harthmere NPCs even if otherwise valid", () => {
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity(
        ctx({
          entityId: "grove-robot",
          position: GROVE_POSITION,
          hasRobotComponent: true,
        })
      ),
      false
    );
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity(
        ctx({
          entityId: "harthmere-person",
          position: HARTHMERE_POSITION,
          hasAppearanceComponent: true,
          hasNpcMetadata: true,
        })
      ),
      false
    );
  });

  it("rejects iced entities", () => {
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity(
        ctx({
          entityId: "iced",
          label: "Frostbound Frogberry",
          hasTalkableDialog: true,
          iced: true,
        })
      ),
      false
    );
  });

  it("rejects entities with no label and no talkable signals (props/scenery)", () => {
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity(
        ctx({ entityId: "scenery" })
      ),
      false
    );
  });

  it("rejects muck monsters even when they have label + default dialog", () => {
    // Seeded entities like "West Breach Muckling" and "Watchtower Mucker"
    // have both labels and authored dialog (`monsterDialog`). They MUST
    // remain quest targets, not quest givers.
    const muckling = ctx({
      entityId: "muckling-1",
      label: "West Breach Muckling",
      hasTalkableDialog: true,
    });
    assert.equal(isLiveEntityHelperQuestEligibleEntity(muckling), false);

    const mucker = ctx({
      entityId: "mucker-1",
      label: "Watchtower Mucker",
      hasTalkableDialog: true,
    });
    assert.equal(isLiveEntityHelperQuestEligibleEntity(mucker), false);

    const muckBeast = ctx({
      entityId: "beast-1",
      label: "Muck-Scarred Helix",
      hasTalkableDialog: true,
    });
    assert.equal(isLiveEntityHelperQuestEligibleEntity(muckBeast), false);
  });

  it("respects an explicit isMuckMonster flag from the caller", () => {
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity(
        ctx({
          entityId: "explicit-muck",
          label: "Frogberry", // benign label
          hasTalkableDialog: true,
          isMuckMonster: true,
        })
      ),
      false
    );
  });

  it("does NOT reject robot sentinels whose area name contains 'Muck'", () => {
    // A "West Muck Breach Sentinel" is a robot. The muck label backstop
    // must defer to the robot signal so we don't accidentally exclude
    // sentinels placed in muck-prone areas.
    const sentinel = ctx({
      entityId: "sentinel-west",
      label: "West Muck Breach Sentinel",
      hasRobotComponent: true,
    });
    assert.equal(isLiveEntityHelperLabelMuckMonster(sentinel.label), false);
    assert.equal(isLiveEntityHelperQuestEligibleEntity(sentinel), true);
  });

  it("rejects Jobs Board entities (their quests live on the board, not on the entity)", () => {
    const labels = [
      "Jobs Board",
      "Job Board",
      "Town Board",
      "Posting Board",
      "Notice Board",
      "Market Bulletin Board",
      "Town Kiosk",
    ];
    for (const label of labels) {
      assert.equal(
        isLiveEntityHelperLabelJobsBoard(label),
        true,
        `${label} should be detected as a jobs board`
      );
      assert.equal(
        isLiveEntityHelperQuestEligibleEntity(
          ctx({
            entityId: `board-${label}`,
            label,
            hasTalkableDialog: true,
          })
        ),
        false,
        `${label} must not generate a helper quest`
      );
    }
  });

  it("respects an explicit isJobsBoard flag from the caller", () => {
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity(
        ctx({
          entityId: "explicit-board",
          label: "Frogberry", // benign label
          hasTalkableDialog: true,
          isJobsBoard: true,
        })
      ),
      false
    );
  });

  it("rejects mount-only entities (Sing Song path, not a helper quest)", () => {
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity(
        ctx({
          entityId: "mount-only",
          label: "Loamhopper",
          isMountOnly: true,
        })
      ),
      false
    );
  });

  it("still accepts a mount that is ALSO a robot or person", () => {
    // The Sing Song affordance applies only when the entity is mount-ONLY.
    // A mount with a robot component (rare, but possible) still gets the
    // helper quest path.
    assert.equal(
      isLiveEntityHelperQuestEligibleEntity(
        ctx({
          entityId: "robot-mount",
          label: "Cog Hopper",
          hasRobotComponent: true,
          isMountOnly: false,
        })
      ),
      true
    );
  });
});
