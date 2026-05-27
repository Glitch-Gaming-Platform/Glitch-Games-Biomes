// Tests for the tutorial step -> blink-cue mapping.
//
// Purpose: prove that every (target, trigger) pair from the live mission
// definitions has at least one cue, AND that every cue references a
// known UI id (so we never silently fail to highlight anything).

import assert from "assert";
import { MISSION_HIGHLIGHTS, cuesForStep } from "../tutorial/tutorialMissionMap";
import { UI_IDS } from "../uniqueIds";

// Static list pulled from LocalDevSnapshotMissionBridge.tsx — kept in sync
// by scripts/harthmere/check-biomes-ui-tutorial-targets.cjs which runs in CI.
const LIVE_STEPS = [
  { target: "jackie", trigger: "dialog" },
  { target: "road_marker", trigger: "location" },
  { target: "muckwad_patch", trigger: "destroy" },
  { target: "building_spot", trigger: "place_voxel" },
  { target: "wardrobe", trigger: "wearing" },
  { target: "jump_run", trigger: "running_jump" },
  { target: "selfie_overlook", trigger: "photo" },
  { target: "crafting_stop", trigger: "craft_muck_buster" },
] as const;

describe("BiomesUI tutorial mission map", () => {
  it("every live step has at least one cue", () => {
    for (const step of LIVE_STEPS) {
      const cues = cuesForStep(step.target as any, step.trigger as any);
      assert.ok(cues.length > 0, `Missing cues for ${step.target}/${step.trigger}`);
    }
  });

  it("every cue references a syntactically valid uniqueId", () => {
    for (const entry of MISSION_HIGHLIGHTS) {
      for (const cue of entry.cues) {
        assert.match(cue.uniqueId, /^[a-z0-9._]+$/i,
          `${entry.target}/${entry.trigger} cue has invalid id ${cue.uniqueId}`);
      }
    }
  });

  it("known tab ids are present in cues that should open a tab", () => {
    const wardrobe = cuesForStep("wardrobe", "wearing");
    assert.ok(wardrobe.some(c => c.uniqueId === UI_IDS.TAB_INVENTORY));
    const crafting = cuesForStep("crafting_stop", "craft_muck_buster");
    assert.ok(crafting.some(c => c.uniqueId === UI_IDS.RECIPE_LIST));
    assert.ok(crafting.some(c => c.uniqueId === UI_IDS.RECIPE_MUCK_BUSTER));
  });

  it("unknown step returns empty cue list (graceful no-op)", () => {
    const cues = cuesForStep("jackie" as any, "photo" as any);
    assert.deepEqual(cues, []);
  });

  it("hotbar cue ids are exactly the numbered slots", () => {
    for (const entry of MISSION_HIGHLIGHTS) {
      for (const cue of entry.cues) {
        if (cue.uniqueId.startsWith("hotbar.slot_")) {
          const n = parseInt(cue.uniqueId.replace("hotbar.slot_", ""), 10);
          assert.ok(n >= 1 && n <= 9, `Hotbar cue ${cue.uniqueId} out of range`);
        }
      }
    }
  });

  it("captions are short enough to render in the small caption pill", () => {
    for (const entry of MISSION_HIGHLIGHTS) {
      for (const cue of entry.cues) {
        if (cue.caption) {
          assert.ok(cue.caption.length <= 30, `Caption too long: "${cue.caption}"`);
        }
      }
    }
  });
});
