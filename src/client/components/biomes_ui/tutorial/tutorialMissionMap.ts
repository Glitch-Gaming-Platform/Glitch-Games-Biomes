// tutorialMissionMap — maps a SnapshotMissionStep's (target, trigger)
// pair to a list of UI ids that should blink for the user.
//
// We deliberately keep this as a pure data table so it can be:
//   1. Unit-tested in isolation (no React / no DOM).
//   2. Audited by a static script (scripts/harthmere/check-biomes-ui-tutorial-targets.cjs).
//   3. Extended without touching the runtime — just add a row here when
//      a new mission step lands.

import { SNAPSHOT_GROVE_QUESTS } from "@/shared/harthmere/snapshot_grove_content";
import { snapshotGroveObjectiveCompletionFixture } from "@/shared/harthmere/snapshot_grove_trigger_contract";
import { UI_IDS } from "../uniqueIds";

export type StepTarget =
  | "jackie"
  | "grove"
  | "road_marker"
  | "muckwad_patch"
  | "building_spot"
  | "wardrobe"
  | "jump_run"
  | "selfie_overlook"
  | "crafting_stop";

export type StepTrigger =
  | "dialog"
  | "location"
  | "destroy"
  | "place_voxel"
  | "wearing"
  | "running_jump"
  | "photo"
  | "craft_muck_buster";

export interface BlinkCue {
  uniqueId: string;
  caption?: string;
  style?: "pulse" | "ring" | "arrow" | "shimmer";
  /** Persistent until the step completes (0 = until cleared) */
  durationMs?: number;
}

export interface MissionHighlightDescriptor {
  target: StepTarget;
  trigger: StepTrigger;
  cues: BlinkCue[];
}

export interface AuthoredTutorialStepCueInput {
  questId?: string;
  objective?: string;
  objectiveIndex?: number;
  trigger?: string;
  markerId?: string;
}

export const MISSION_HIGHLIGHTS: MissionHighlightDescriptor[] = [
  // Talk to Jackie — highlight the map marker + open the map tab.
  {
    target: "jackie", trigger: "dialog",
    cues: [
      { uniqueId: UI_IDS.MAP_MARKER("jackie"), style: "ring", caption: "Speak with Jackie", durationMs: 0 },
      { uniqueId: UI_IDS.TAB_MAP, style: "pulse", caption: "Open map", durationMs: 6000 },
    ],
  },
  // Reach the road marker.
  {
    target: "road_marker", trigger: "location",
    cues: [
      { uniqueId: UI_IDS.MAP_MARKER("road_marker"), style: "ring", caption: "Head here", durationMs: 0 },
      { uniqueId: UI_IDS.TAB_MAP, style: "pulse", durationMs: 4500 },
    ],
  },
  // Break muckwad — flag the hotbar tool you'd use.
  {
    target: "muckwad_patch", trigger: "destroy",
    cues: [
      { uniqueId: UI_IDS.MAP_MARKER("muckwad_patch"), style: "ring", caption: "Break this", durationMs: 0 },
      { uniqueId: UI_IDS.HOTBAR_SLOT(1), style: "pulse", caption: "Use your tool", durationMs: 6000 },
    ],
  },
  // Place a block — highlight the hotbar block slot.
  {
    target: "building_spot", trigger: "place_voxel",
    cues: [
      { uniqueId: UI_IDS.MAP_MARKER("building_spot"), style: "ring", caption: "Place here", durationMs: 0 },
      { uniqueId: UI_IDS.HOTBAR_SLOT(2), style: "pulse", caption: "Equip a block", durationMs: 6000 },
    ],
  },
  // Gear up — open Inventory tab + blink the chest/legs slots.
  {
    target: "wardrobe", trigger: "wearing",
    cues: [
      { uniqueId: UI_IDS.TAB_INVENTORY, style: "pulse", caption: "Open inventory", durationMs: 0 },
      { uniqueId: UI_IDS.INVENTORY_SLOT_CHEST, style: "ring", caption: "Equip a top", durationMs: 0 },
      { uniqueId: UI_IDS.INVENTORY_SLOT_LEGS, style: "ring", caption: "Equip bottoms", durationMs: 0 },
    ],
  },
  // Running jump.
  {
    target: "jump_run", trigger: "running_jump",
    cues: [
      { uniqueId: UI_IDS.CUE_SPRINT, style: "pulse", caption: "Hold Shift to sprint", durationMs: 0 },
      { uniqueId: UI_IDS.CUE_JUMP, style: "pulse", caption: "Press Space to jump", durationMs: 0 },
    ],
  },
  // Selfie.
  {
    target: "selfie_overlook", trigger: "photo",
    cues: [
      { uniqueId: UI_IDS.MAP_MARKER("selfie_overlook"), style: "ring", caption: "Stand here", durationMs: 0 },
      { uniqueId: UI_IDS.CAMERA_BUTTON, style: "pulse", caption: "Open camera", durationMs: 0 },
      { uniqueId: UI_IDS.CAMERA_SELFIE_MODE, style: "ring", caption: "Flip to selfie", durationMs: 0 },
    ],
  },
  // Craft a muck buster — highlight the recipes tab and the specific recipe.
  {
    target: "crafting_stop", trigger: "craft_muck_buster",
    cues: [
      { uniqueId: UI_IDS.RECIPE_LIST, style: "pulse", caption: "Open recipes", durationMs: 0 },
      { uniqueId: UI_IDS.RECIPE_MUCK_BUSTER, style: "ring", caption: "Craft this", durationMs: 0 },
    ],
  },
];

/** Lookup helper used by the runtime director. */
export function cuesForStep(target: StepTarget, trigger: StepTrigger): BlinkCue[] {
  const match = MISSION_HIGHLIGHTS.find(
    (h) => h.target === target && h.trigger === trigger
  );
  return match?.cues ?? [];
}

function addCue(cues: BlinkCue[], cue: BlinkCue) {
  if (cues.some((entry) => entry.uniqueId === cue.uniqueId)) {
    return;
  }
  cues.push(cue);
}

function addMenuTabCue(cues: BlinkCue[], uniqueId: string, caption: string) {
  addCue(cues, {
    uniqueId: UI_IDS.HUD_PROMPT_OPEN_MENU,
    style: "pulse",
    caption: "Open menu",
    durationMs: 0,
  });
  addCue(cues, {
    uniqueId,
    style: "pulse",
    caption,
    durationMs: 0,
  });
}

function normalizedMarkerId(markerId: string | undefined) {
  return String(markerId ?? "")
    .trim()
    .replace(/^npc_/, "");
}

function textMatches(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function authoredTutorialInventoryItemIdForStep(
  input: AuthoredTutorialStepCueInput,
  text: string,
): string | undefined {
  const quest = input.questId
    ? SNAPSHOT_GROVE_QUESTS.find((entry) => entry.id === input.questId)
    : undefined;
  if (quest) {
    const explicitIndex = Number(input.objectiveIndex);
    const objectiveIndex = Number.isFinite(explicitIndex)
      ? Math.max(0, Math.floor(explicitIndex))
      : quest.objectives.findIndex((objective) => objective === input.objective);
    if (objectiveIndex >= 0) {
      const fixture = snapshotGroveObjectiveCompletionFixture(
        quest,
        objectiveIndex,
      );
      if (fixture?.trigger === "item_use" && fixture.itemId) {
        return fixture.itemId;
      }
    }
  }

  if (/ration|food|snack|eat|stamina/.test(text)) return "road_ration";
  if (/bandage|first.?aid|scratch|wound|medicine|salve|health/.test(text)) {
    return "minor_healing_salve";
  }
  if (/stone|repair piece|block|road block|hotbar|hold/.test(text)) {
    return "rough_stone";
  }
  if (/bolt|coil|metal/.test(text)) return "scrap_metal";
  if (/key/.test(text)) return "iron_key_blank";
  return undefined;
}

/**
 * Direct cue helper for authored Grove tutorial quests.
 *
 * The older target/trigger table above covers the compact SnapshotMission
 * bridge. Grove fountain quests are richer: several objectives say "open the
 * inventory", "open chat", "check health/stamina", or "drop from hotbar".
 * This helper maps those authored objective words into concrete BiomesUI/HUD
 * targets so the tab and the useful control both flash.
 */
export function cuesForAuthoredTutorialStep(
  input: AuthoredTutorialStepCueInput,
): BlinkCue[] {
  const trigger = String(input.trigger ?? "").toLowerCase();
  const markerId = normalizedMarkerId(input.markerId);
  const text = [
    input.questId,
    input.objective,
    input.trigger,
    markerId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const cues: BlinkCue[] = [];

  if (!text.trim()) {
    return cues;
  }

  const inventoryItemId =
    ["item_use", "open_tab", "interact", "inventory_change"].includes(trigger)
      ? authoredTutorialInventoryItemIdForStep(input, text)
      : undefined;

  if (markerId && markerId !== "the_grove") {
    addCue(cues, {
      uniqueId: UI_IDS.MAP_MARKER(markerId),
      style: "ring",
      caption: "Next stop",
      durationMs: 0,
    });
  }

  if (
    trigger === "open_tab" ||
    trigger === "choice" ||
    trigger === "item_grant" ||
    trigger === "interact" ||
    trigger === "near_location" ||
    trigger === "place_voxel" ||
    trigger === "destroy" ||
    textMatches(text, /\b(open|pin|confirm|find)\b.*\b(map|marker|journal|objective|panel|hud|menu|inventory|bag|backpack|hotbar|guild|party|group|combat|duel|mail|inbox|storage|bank|vault|recipe|craft|chat|channel|whisper|settings|options)\b/)
  ) {
    if (textMatches(text, /\b(map|marker|pin|compass|journal|quest log|objective)\b/)) {
      addMenuTabCue(cues, UI_IDS.TAB_MAP, "Open map");
    }
    if (textMatches(text, /\b(inventory|bag|backpack|clothing|equip|wear|gear|hotbar)\b/)) {
      addMenuTabCue(cues, UI_IDS.TAB_INVENTORY, "Open inventory");
    }
    if (textMatches(text, /\b(guild|party|group|ready|charter|role)\b/)) {
      addMenuTabCue(cues, UI_IDS.TAB_GUILDS, "Open guilds");
      addCue(cues, {
        uniqueId: UI_IDS.GUILD_ROSTER,
        style: "pulse",
        caption: "Guild roster",
        durationMs: 0,
      });
    }
    if (textMatches(text, /\b(rank|leader|officer|builder|treasurer|scout|member)\b/)) {
      addCue(cues, {
        uniqueId: UI_IDS.GUILD_RANK("leader"),
        style: "ring",
        caption: "Practice ranks",
        durationMs: 0,
      });
    }
    if (textMatches(text, /\b(combat|duel|sparring|pvp|ability|weapon)\b/)) {
      addMenuTabCue(cues, UI_IDS.TAB_ABILITIES, "Open abilities");
    }
    if (
      textMatches(text, /\b(mail|inbox|message|letter|parcel)\b/) &&
      (trigger !== "interact" ||
        textMatches(text, /\b(open|send|drop|deliver)\b/))
    ) {
      addMenuTabCue(cues, UI_IDS.TAB_INBOX, "Open inbox");
    }
    if (
      textMatches(text, /\b(storage|bank|vault|deposit|withdraw|recovery|lost.?and.?found|lost|found)\b/) &&
      (trigger !== "interact" ||
        textMatches(text, /\b(open|deposit|withdraw|store|organize|recover)\b/))
    ) {
      addMenuTabCue(cues, UI_IDS.TAB_BANKING, "Open bank");
      if (textMatches(text, /\b(deposit|bank|crate)\b/)) {
        addCue(cues, {
          uniqueId: UI_IDS.BANKING_DEPOSIT,
          style: "pulse",
          caption: "Deposit",
          durationMs: 0,
        });
      }
      if (textMatches(text, /\b(withdraw)\b/)) {
        addCue(cues, {
          uniqueId: UI_IDS.BANKING_WITHDRAW,
          style: "pulse",
          caption: "Withdraw",
          durationMs: 0,
        });
      }
    }
    if (textMatches(text, /\b(project|shared project|bridge plank|shared kit|guild hall|guild bank)\b/)) {
      addMenuTabCue(cues, UI_IDS.TAB_GUILDS, "Open guilds");
      addCue(cues, {
        uniqueId: UI_IDS.GUILD_BUILDING_GUIDE,
        style: "pulse",
        caption: "Guild project",
        durationMs: 0,
      });
    }
    if (textMatches(text, /\b(claim|lot|land|building|build|foundation|safe-zone|wild|wilderness|stall|hall)\b/)) {
      addMenuTabCue(cues, UI_IDS.TAB_LAND, "Open land");
    }
    if (textMatches(text, /\b(recipe|craft|workbench|torch|muck buster)\b/)) {
      addCue(cues, {
        uniqueId: UI_IDS.RECIPE_LIST,
        style: "pulse",
        caption: "Recipes",
        durationMs: 0,
      });
    }
    if (textMatches(text, /\b(chat|channel|whisper|say message|say)\b/)) {
      addCue(cues, {
        uniqueId: UI_IDS.HUD_CHAT_BUTTON,
        style: "pulse",
        caption: "Open chat",
        durationMs: 0,
      });
    }
    if (textMatches(text, /\b(settings|options|preferences)\b/)) {
      addMenuTabCue(cues, UI_IDS.TAB_OPTIONS, "Open options");
    }
  }

  if (
    ["inventory_change", "item_use", "item_grant", "item_update", "collect"].includes(trigger) ||
    textMatches(text, /\b(equip|wear|food|ration|eat|bandage|first.?aid|medicine|item|material|stone|stick|torch|sample|berry|root|key|bolt)\b/)
  ) {
    addMenuTabCue(cues, UI_IDS.TAB_INVENTORY, "Open inventory");
  }

  if (inventoryItemId) {
    addMenuTabCue(cues, UI_IDS.TAB_INVENTORY, "Open inventory");
    addCue(cues, {
      uniqueId: UI_IDS.INVENTORY_ITEM(inventoryItemId),
      style: "ring",
      caption: "This item",
      durationMs: 0,
    });
    if (trigger === "item_use") {
      addCue(cues, {
        uniqueId: UI_IDS.INVENTORY_ACTION("use"),
        style: "pulse",
        caption: "Use item",
        durationMs: 0,
      });
    }
  }

  if (textMatches(text, /\b(equip|wear|clothing|top|shirt|armor|bottom|pants|legs|boots|feet|gloves|hands)\b/)) {
    if (textMatches(text, /\b(top|shirt|armor|chest|clothing|piece)\b/)) {
      addCue(cues, {
        uniqueId: UI_IDS.INVENTORY_SLOT_CHEST,
        style: "ring",
        caption: "Equip top",
        durationMs: 0,
      });
    }
    if (textMatches(text, /\b(bottom|pants|legs|clothing|piece)\b/)) {
      addCue(cues, {
        uniqueId: UI_IDS.INVENTORY_SLOT_LEGS,
        style: "ring",
        caption: "Equip bottoms",
        durationMs: 0,
      });
    }
  }

  if (textMatches(text, /\b(use|eat|apply|consume)\b/)) {
    addCue(cues, {
      uniqueId: UI_IDS.INVENTORY_ACTION("use"),
      style: "pulse",
      caption: "Use item",
      durationMs: 0,
    });
  }

  if (textMatches(text, /\b(hotbar|quick-action|quick action|bound slot|drop|pick.*back|hold)\b/)) {
    addCue(cues, {
      uniqueId: UI_IDS.HOTBAR_SLOT(1),
      style: "pulse",
      caption: "Hotbar slot",
      durationMs: 0,
    });
  }

  if (
    trigger === "place_voxel" ||
    textMatches(text, /\b(place|block|foundation|road block)\b/)
  ) {
    addCue(cues, {
      uniqueId: UI_IDS.HOTBAR_SLOT(2),
      style: "pulse",
      caption: "Equip block",
      durationMs: 0,
    });
  }

  if (
    trigger === "destroy" ||
    textMatches(text, /\b(break|gather|rubble|muck|material)\b/)
  ) {
    addCue(cues, {
      uniqueId: UI_IDS.HOTBAR_SLOT(1),
      style: "pulse",
      caption: "Use tool",
      durationMs: 0,
    });
  }

  if (textMatches(text, /\b(repair|fence|cart|kit)\b/)) {
    addMenuTabCue(cues, UI_IDS.TAB_INVENTORY, "Open inventory");
    addCue(cues, {
      uniqueId: UI_IDS.HOTBAR_SLOT(1),
      style: "pulse",
      caption: "Repair tool",
      durationMs: 0,
    });
  }

  if (textMatches(text, /\b(drop|dropped)\b/)) {
    addCue(cues, {
      uniqueId: UI_IDS.INVENTORY_ACTION("drop-one"),
      style: "pulse",
      caption: "Drop item",
      durationMs: 0,
    });
  }

  if (trigger === "status_check" || textMatches(text, /\b(health|stamina|vitals|quick-action|quick action)\b/)) {
    addCue(cues, {
      uniqueId: UI_IDS.HUD_VITALS,
      style: "pulse",
      caption: "Check vitals",
      durationMs: 0,
    });
    if (textMatches(text, /\b(health|bandage|first.?aid|medicine|wound)\b/)) {
      addCue(cues, {
        uniqueId: UI_IDS.HUD_VITALS_HEALTH,
        style: "ring",
        caption: "Health",
        durationMs: 0,
      });
    }
    if (textMatches(text, /\b(stamina|food|ration|eat|jog|run)\b/)) {
      addCue(cues, {
        uniqueId: UI_IDS.HUD_VITALS_STAMINA,
        style: "ring",
        caption: "Stamina",
        durationMs: 0,
      });
    }
  }

  if (textMatches(text, /\b(photo|camera|selfie)\b/)) {
    addCue(cues, {
      uniqueId: UI_IDS.CAMERA_BUTTON,
      style: "pulse",
      caption: "Camera",
      durationMs: 0,
    });
    if (textMatches(text, /\b(selfie)\b/)) {
      addCue(cues, {
        uniqueId: UI_IDS.CAMERA_SELFIE_MODE,
        style: "ring",
        caption: "Selfie",
        durationMs: 0,
      });
    }
  }

  if (textMatches(text, /\b(sprint|jump|jog|run)\b/)) {
    addCue(cues, {
      uniqueId: UI_IDS.CUE_SPRINT,
      style: "pulse",
      caption: "Sprint",
      durationMs: 0,
    });
    if (textMatches(text, /\b(jump)\b/)) {
      addCue(cues, {
        uniqueId: UI_IDS.CUE_JUMP,
        style: "pulse",
        caption: "Jump",
        durationMs: 0,
      });
    }
  }

  return cues;
}
