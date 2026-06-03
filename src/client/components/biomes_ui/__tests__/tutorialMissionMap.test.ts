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

  it("authored item-use steps flash the exact granted inventory item and use action", () => {
    const cues = cuesForAuthoredTutorialStep({
      questId: "fountain_food_keeps_you_moving",
      objective: "Eat the ration and watch your stamina settle.",
      objectiveIndex: 2,
      trigger: "item_use",
      markerId: "grove_food_satchel",
    });
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.TAB_INVENTORY));
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.INVENTORY_ITEM("road_ration")));
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.INVENTORY_ACTION("use")));
  });

  it("authored setup steps can flash the granted item without forcing use yet", () => {
    const cues = cuesForAuthoredTutorialStep({
      questId: "fountain_hotbar_and_dropping",
      objective: "Open the inventory and drag a practice stone onto the hotbar.",
      objectiveIndex: 1,
      trigger: "open_tab",
      markerId: "grove_fountain_lesson_board",
    });
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.TAB_INVENTORY));
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.INVENTORY_ITEM("rough_stone")));
    assert.equal(cues.some((c) => c.uniqueId === UI_IDS.INVENTORY_ACTION("use")), false);
  });

  it("Luis's build/claim lesson flashes land, marker, hotbar, and inventory cues", () => {
    const claim = cuesForAuthoredTutorialStep({
      questId: "build_repair_claim_lesson",
      objective: "Inspect the Grove Practice Claim Stakes beside the safe road.",
      objectiveIndex: 1,
      trigger: "near_location",
      markerId: "grove_claim_stakes",
    });
    assert.ok(claim.some((c) => c.uniqueId === UI_IDS.MAP_MARKER("grove_claim_stakes")));
    assert.ok(claim.some((c) => c.uniqueId === UI_IDS.TAB_LAND));

    const gather = cuesForAuthoredTutorialStep({
      questId: "build_repair_claim_lesson",
      objective: "Gather or break loose repair material near the practice lot.",
      objectiveIndex: 2,
      trigger: "destroy",
      markerId: "muckwad_patch",
    });
    assert.ok(gather.some((c) => c.uniqueId === UI_IDS.HOTBAR_SLOT(1)));

    const place = cuesForAuthoredTutorialStep({
      questId: "build_repair_claim_lesson",
      objective: "Place one block inside the marked practice claim so the foundation is visible.",
      objectiveIndex: 3,
      trigger: "place_voxel",
      markerId: "building_practice_spot",
    });
    assert.ok(place.some((c) => c.uniqueId === UI_IDS.HOTBAR_SLOT(2)));

    const ledger = cuesForAuthoredTutorialStep({
      questId: "build_repair_claim_lesson",
      objective: "Read the Practice Land Ledger to compare personal lots, rented stalls, guild halls, and wild claims.",
      objectiveIndex: 5,
      trigger: "open_tab",
      markerId: "grove_land_ledger",
    });
    assert.ok(ledger.some((c) => c.uniqueId === UI_IDS.TAB_LAND));
  });

  it("Nia's guild lesson flashes guild, rank, bank, and project controls", () => {
    const charter = cuesForAuthoredTutorialStep({
      questId: "guilds_are_promises",
      objective: "Read the sample charter and pick a guild focus: crafting, gathering, PvE, PvP, trade, social, or building.",
      objectiveIndex: 1,
      trigger: "choice",
      markerId: "guild_charter_board",
    });
    assert.ok(charter.some((c) => c.uniqueId === UI_IDS.MAP_MARKER("guild_charter_board")));
    assert.ok(charter.some((c) => c.uniqueId === UI_IDS.TAB_GUILDS));
    assert.ok(charter.some((c) => c.uniqueId === UI_IDS.GUILD_ROSTER));

    const ranks = cuesForAuthoredTutorialStep({
      questId: "guilds_are_promises",
      objective: "Assign practice ranks for leader, officer, builder, treasurer, scout, and member.",
      objectiveIndex: 2,
      trigger: "choice",
      markerId: "guild_charter_board",
    });
    assert.ok(ranks.some((c) => c.uniqueId === UI_IDS.GUILD_RANK("leader")));

    const bank = cuesForAuthoredTutorialStep({
      questId: "guilds_are_promises",
      objective: "Deposit a harmless practice item into the guild bank crate and review who may withdraw it.",
      objectiveIndex: 3,
      trigger: "item_grant",
      markerId: "guild_bank_crate",
    });
    assert.ok(bank.some((c) => c.uniqueId === UI_IDS.TAB_BANKING));
    assert.ok(bank.some((c) => c.uniqueId === UI_IDS.BANKING_DEPOSIT));

    const project = cuesForAuthoredTutorialStep({
      questId: "guilds_are_promises",
      objective: "Start a tiny guild project at the project table: repair a sign, fund a bridge plank, or stock a shared kit.",
      objectiveIndex: 4,
      trigger: "interact",
      markerId: "guild_project_table",
    });
    assert.ok(project.some((c) => c.uniqueId === UI_IDS.TAB_GUILDS));
    assert.ok(project.some((c) => c.uniqueId === UI_IDS.GUILD_BUILDING_GUIDE));
  });

  it("authored hotbar item-use steps flash the practice item, hotbar, and use action", () => {
    const cues = cuesForAuthoredTutorialStep({
      questId: "fountain_hotbar_and_dropping",
      objective: "Press the bound hotbar slot to hold the practice stone.",
      objectiveIndex: 2,
      trigger: "item_use",
      markerId: "grove_fountain_lesson_board",
    });
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.INVENTORY_ITEM("rough_stone")));
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.HOTBAR_SLOT(1)));
    assert.ok(cues.some((c) => c.uniqueId === UI_IDS.INVENTORY_ACTION("use")));
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
