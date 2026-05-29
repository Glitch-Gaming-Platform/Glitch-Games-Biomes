// Tests for the tutorial step -> blink-cue mapping.
//
// Purpose: prove that every (target, trigger) pair from the live mission
// definitions has at least one cue, AND that every cue references a
// known UI id (so we never silently fail to highlight anything).

import assert from "assert";
import {
  MISSION_HIGHLIGHTS,
  cuesForAuthoredTutorialStep,
  cuesForStep,
} from "../tutorial/tutorialMissionMap";
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

  it("authored Grove open-tab steps flash the menu prompt and destination tab", () => {
    const cues = cuesForAuthoredTutorialStep({
      questId: "fountain_buttons_first",
      objective: "Open the map and confirm the Grove marker is visible.",
      trigger: "open_tab",
      markerId: "the_grove",
    });
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.HUD_PROMPT_OPEN_MENU));
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.TAB_MAP));
  });

  it("authored inventory equipment steps flash both the tab and equipment slots", () => {
    const cues = cuesForAuthoredTutorialStep({
      questId: "road_ready_bag_check",
      objective: "Equip or confirm one road-ready clothing piece.",
      trigger: "inventory_change",
      markerId: "lovely_locks_mirror",
    });
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.TAB_INVENTORY));
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.INVENTORY_SLOT_CHEST));
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.INVENTORY_SLOT_LEGS));
  });

  it("authored chat and guild panel steps have visible replacement BiomesUI cues", () => {
    const chat = cuesForAuthoredTutorialStep({
      questId: "fountain_chat_channels",
      objective: "Open the chat panel from the HUD.",
      trigger: "open_tab",
      markerId: "grove_chat_practice_board",
    });
    assert.ok(chat.some((c) => c.uniqueId === UI_IDS.HUD_CHAT_BUTTON));

    const guild = cuesForAuthoredTutorialStep({
      questId: "ready_check_at_fountain",
      objective: "Open the guild or party panel from the HUD.",
      trigger: "open_tab",
      markerId: "guild_charter_board",
    });
    assert.ok(guild.some((c) => c.uniqueId === UI_IDS.HUD_PROMPT_OPEN_MENU));
    assert.ok(guild.some((c) => c.uniqueId === UI_IDS.TAB_GUILDS));
  });

  it("authored status-check steps flash concrete vitals instead of a dead data-ui-id", () => {
    const cues = cuesForAuthoredTutorialStep({
      questId: "road_ready_bag_check",
      objective: "Check the health, stamina, and quick-action bars before walking away.",
      trigger: "status_check",
      markerId: "grove_hud_compass_ring",
    });
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.HUD_VITALS));
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.HUD_VITALS_HEALTH));
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.HUD_VITALS_STAMINA));
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.HOTBAR_SLOT(1)));
  });

  it("authored cue derivation dedupes overlapping map/journal wording", () => {
    const cues = cuesForAuthoredTutorialStep({
      objective: "Open the map, pin the marker, and read the quest journal objective.",
      trigger: "open_tab",
      markerId: "grove_hud_compass_ring",
    });
    const mapCueCount = cues.filter((c) => c.uniqueId === UI_IDS.TAB_MAP).length;
    assert.equal(mapCueCount, 1);
  });

  it("unknown step returns empty cue list (graceful no-op)", () => {
    const cues = cuesForStep("jackie" as any, "photo" as any);
    assert.deepEqual(cues, []);
    assert.deepEqual(cuesForAuthoredTutorialStep({}), []);
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
