// CHAPTER_1_NPC_LIVE_AUDIT
//
// Source-backed matrix for the final exact-image browser pass. It deliberately
// contains story inputs rather than browser commands: the E2E bridge resolves
// the same production staging functions used by the player and the browser
// runner only warps, counts, inspects, talks, and captures screenshots.

import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import { ch1CastVisualForEntity } from "@/shared/harthmere/ch1_cast_visuals";
import { CH1_DUNGEON_ESCORT_NPCS } from "@/shared/harthmere/ch1_dungeon_encounters";
import { ch1DungeonAuthoredToWorld } from "@/shared/harthmere/ch1_dungeon_terrain";
import {
  CH1_ANCHORS,
  CH1_FLAGS,
  type Ch1Vec3,
} from "@/shared/harthmere/ch1_ids";
import { CH1_GROVE_SUPPLIER_ROUTE } from "@/shared/harthmere/ch1_objective_routes";
import {
  CH1_SERGEANT_HOLT,
  ch1ReturningNpcStageDirections,
} from "@/shared/harthmere/ch1_returning_npcs";
import {
  ch1StageDirections,
  type Ch1StagedNpc,
  type Ch1StagingInput,
} from "@/shared/harthmere/ch1_staging";
import { CH1_TESTIMONY_NPC_SEEDS } from "@/shared/harthmere/ch1_testimony_npcs";
import {
  SNAPSHOT_GROVE_JACKIE_ENTITY_ID,
  SNAPSHOT_GROVE_JACKIE_ORIGINAL_SPAWN_POSITION,
} from "@/shared/harthmere/snapshot_grove_ids";
import {
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveGroundedPosition,
  snapshotGroveNpcEntityId,
} from "@/shared/harthmere/snapshot_grove_content";
import type { BiomesId } from "@/shared/ids";

export const CH1_NPC_LIVE_AUDIT_VERSION = "chapter1-npc-live-audit-v1" as const;

export interface Ch1NpcLiveAuditScenario {
  id: string;
  label: string;
  input: Ch1StagingInput;
  focus: Ch1Vec3;
  expectedPresentKeys: readonly string[];
  expectedAbsentKeys?: readonly string[];
  /** Actor whose visible body must own the nearby nameplate and F — Talk. */
  talkKey?: string;
}

const dungeonNpcPosition = (key: "iris_fen" | "marrow" | "nadia_sorrel") =>
  CH1_DUNGEON_ESCORT_NPCS.find(
    (npc) =>
      Number(npc.entityId) ===
      Number(CH1_NEW_CAST.find((c) => c.key === key)?.entityId)
  )!.startPosition;

const hallrPosition = ch1DungeonAuthoredToWorld("ch1_dungeon_winter", {
  x: 384,
  y: 1,
  z: -88,
});

/**
 * One scenario per distinct authored stage or absence rule. Several nearby
 * actors share a screenshot, keeping the final WebGL pass serial and bounded.
 */
export const CH1_NPC_LIVE_AUDIT_SCENARIOS: readonly Ch1NpcLiveAuditScenario[] =
  Object.freeze([
    {
      id: "starter-jackie-road-ahead",
      label: "Starter Jackie at the original Grove stores approach",
      input: { flags: [] },
      focus: SNAPSHOT_GROVE_JACKIE_ORIGINAL_SPAWN_POSITION,
      expectedPresentKeys: ["jackie"],
      talkKey: "jackie",
    },
    {
      id: "starter-augur-mucked-robot",
      label: "Canonical pre-chapter Mucked Robot",
      input: { flags: [] },
      focus: CH1_NEW_CAST.find((member) => member.key === "augur9")!.placement!,
      expectedPresentKeys: ["augur9"],
      talkKey: "augur9",
    },
    {
      id: "act1-roadhouse",
      label: "Jackie and Coretta at the road-house",
      input: { flags: [CH1_FLAGS.started] },
      focus: CH1_ANCHORS.roadhouse_table,
      expectedPresentKeys: ["jackie", "coretta"],
      talkKey: "jackie",
    },
    {
      id: "act1-fence-walk",
      label: "Jackie walking the broken fence",
      input: {
        flags: [CH1_FLAGS.started],
        activeStepId: "walk_with_jackie",
      },
      focus: CH1_ANCHORS.broken_safe_zone_fence,
      expectedPresentKeys: ["jackie"],
      talkKey: "jackie",
    },
    {
      id: "act1-first-seam",
      label: "Jackie at the first seam",
      input: { flags: [CH1_FLAGS.started], activeStepId: "the_seam" },
      focus: CH1_ANCHORS.gate_fence_sighting,
      expectedPresentKeys: ["jackie"],
      talkKey: "jackie",
    },
    {
      id: "act2-greenlamp-examination",
      label: "Dr. Ardan at Greenlamp clinic",
      input: {
        flags: [CH1_FLAGS.started],
        activeStepId: "the_examination",
      },
      focus: CH1_ANCHORS.greenlamp_clinic,
      expectedPresentKeys: ["lou_ardan"],
      talkKey: "lou_ardan",
    },
    {
      id: "act2-harthmere-bridge",
      label: "Halden Rook at the Harthmere bridge",
      input: { flags: [CH1_FLAGS.started] },
      focus: CH1_ANCHORS.harthmere_bridge_center,
      expectedPresentKeys: ["halden_rook"],
      talkKey: "halden_rook",
    },
    {
      id: "act2-desert-footprints",
      label: "Halden Rook at the desert aperture",
      input: {
        flags: [CH1_FLAGS.started, CH1_FLAGS.gatePersistentOpen],
        activeStepId: "the_footprints",
      },
      focus: CH1_ANCHORS.gate_desert,
      expectedPresentKeys: ["halden_rook"],
      talkKey: "halden_rook",
    },
    {
      id: "act2-the-flinch",
      label: "Jackie and Rook at the desert aperture",
      input: {
        flags: [CH1_FLAGS.started, CH1_FLAGS.gatePersistentOpen],
        activeStepId: "the_flinch",
      },
      focus: CH1_ANCHORS.gate_desert,
      expectedPresentKeys: ["jackie", "halden_rook"],
      talkKey: "jackie",
    },
    {
      id: "act3-returnstone",
      label: "Arbiter Vane at Returnstone",
      input: {
        flags: [CH1_FLAGS.started, CH1_FLAGS.gatePersistentOpen],
      },
      focus: CH1_ANCHORS.returnstone_pad_office,
      expectedPresentKeys: ["cressa_vane"],
      talkKey: "cressa_vane",
    },
    {
      id: "act3-desert-dungeon",
      label: "Iris and Marrow in the desert Elsewhen",
      input: { flags: [CH1_FLAGS.started] },
      focus: dungeonNpcPosition("iris_fen"),
      expectedPresentKeys: ["iris_fen", "marrow"],
      talkKey: "iris_fen",
    },
    {
      id: "act3-lovely-locks",
      label: "Rescued Iris and Marrow at Lovely Locks",
      input: {
        flags: [
          CH1_FLAGS.started,
          CH1_FLAGS.irisRescued,
          CH1_FLAGS.marrowSaved,
        ],
      },
      focus: CH1_ANCHORS.lovely_locks_mirror,
      expectedPresentKeys: ["iris_fen", "marrow"],
      talkKey: "iris_fen",
    },
    {
      id: "act4-rat-crowns",
      label: "Teak Morrow at Rat Crowns",
      input: { flags: [CH1_FLAGS.started] },
      focus: CH1_ANCHORS.rat_crowns_den,
      expectedPresentKeys: ["teak_morrow"],
      talkKey: "teak_morrow",
    },
    {
      id: "act4-ashline",
      label: "Wen Halloway and Calla Ashe at Ashline",
      input: { flags: [CH1_FLAGS.started, CH1_FLAGS.act3Complete] },
      focus: CH1_ANCHORS.ashline_containment_works,
      expectedPresentKeys: ["wen_halloway", "calla_ashe"],
      talkKey: "calla_ashe",
    },
    {
      id: "act4-statement",
      label: "Jackie and Sergeant Holt at the Grove watch house",
      input: {
        flags: [CH1_FLAGS.started, CH1_FLAGS.teakDetained],
        activeQuestId: "ch1_a4_q07_ask_me_in_a_month",
        activeStepId: "report_or_not",
      },
      focus: CH1_ANCHORS.grove_watch_house,
      expectedPresentKeys: ["jackie", "teak_morrow", "sergeant_bram_holt"],
      talkKey: "sergeant_bram_holt",
    },
    {
      id: "act5-winter-dungeon",
      label: "Nadia in the winter Elsewhen",
      input: { flags: [CH1_FLAGS.started, CH1_FLAGS.act4Complete] },
      focus: dungeonNpcPosition("nadia_sorrel"),
      expectedPresentKeys: ["nadia_sorrel"],
      talkKey: "nadia_sorrel",
    },
    {
      id: "act5-hallr-settlement",
      label: "Hallr in the winter settlement",
      input: { flags: [CH1_FLAGS.started, CH1_FLAGS.act4Complete] },
      focus: hallrPosition,
      expectedPresentKeys: ["hallr_ironmouth"],
      talkKey: "hallr_ironmouth",
    },
    {
      id: "act6-greenlamp",
      label: "Nadia Sorrel at Greenlamp clinic",
      input: { flags: [CH1_FLAGS.started, CH1_FLAGS.act5Complete] },
      focus: CH1_ANCHORS.greenlamp_clinic,
      expectedPresentKeys: ["nadia_sorrel"],
      talkKey: "nadia_sorrel",
    },
    {
      id: "act6-returnstone",
      label: "Dr. Ardan and Arbiter Vane at Returnstone",
      input: { flags: [CH1_FLAGS.started, CH1_FLAGS.act5Complete] },
      focus: CH1_ANCHORS.returnstone_pad_office,
      expectedPresentKeys: ["lou_ardan", "cressa_vane"],
      talkKey: "lou_ardan",
    },
    {
      id: "act6-watch-house",
      label: "Jackie and detained Teak at the watch house",
      input: {
        flags: [
          CH1_FLAGS.started,
          CH1_FLAGS.act5Complete,
          CH1_FLAGS.jackieExpelled,
          CH1_FLAGS.teakDetained,
        ],
        activeStepId: "the_whole_plan",
      },
      focus: CH1_ANCHORS.grove_watch_house,
      expectedPresentKeys: ["jackie", "teak_morrow"],
      talkKey: "jackie",
    },
    {
      id: "ending-contain-absence",
      label: "Contain ending removes Jackie and Teak",
      input: {
        flags: [
          CH1_FLAGS.started,
          CH1_FLAGS.complete,
          CH1_FLAGS.jackieExpelled,
          CH1_FLAGS.teakDetained,
        ],
        ending: "contain",
      },
      focus: CH1_ANCHORS.grove_watch_house,
      expectedPresentKeys: [],
      expectedAbsentKeys: ["jackie", "teak_morrow"],
    },
    {
      id: "ending-confess-roadhouse",
      label: "Confess ending returns Jackie to the road-house",
      input: {
        flags: [
          CH1_FLAGS.started,
          CH1_FLAGS.complete,
          CH1_FLAGS.jackieExpelled,
        ],
        ending: "confess",
      },
      focus: CH1_ANCHORS.roadhouse_jackie_post,
      expectedPresentKeys: ["jackie"],
      talkKey: "jackie",
    },
    {
      id: "ending-ledger-surrendered",
      label: "Ledger surrender removes Ardan and Sorrel",
      input: {
        flags: [
          CH1_FLAGS.started,
          CH1_FLAGS.act5Complete,
          CH1_FLAGS.ledgerSurrendered,
        ],
      },
      focus: CH1_ANCHORS.returnstone_pad_office,
      expectedPresentKeys: ["cressa_vane"],
      expectedAbsentKeys: ["lou_ardan", "nadia_sorrel"],
      talkKey: "cressa_vane",
    },
    {
      id: "ending-hallr-runs",
      label: "Letting the year run removes Hallr",
      input: {
        flags: [CH1_FLAGS.started, CH1_FLAGS.act4Complete],
        hallrChoice: "let_run",
      },
      focus: hallrPosition,
      expectedPresentKeys: [],
      expectedAbsentKeys: ["hallr_ironmouth"],
    },
  ]);

export function ch1NpcLiveAuditStaging(input: Ch1StagingInput): Ch1StagedNpc[] {
  return [
    ...ch1StageDirections(input),
    ...ch1ReturningNpcStageDirections(input),
  ];
}

export function ch1NpcLiveAuditScenario(id: string) {
  return CH1_NPC_LIVE_AUDIT_SCENARIOS.find((scenario) => scenario.id === id);
}

export interface Ch1SharedNpcLiveAuditEntry {
  entityId: BiomesId;
  displayName: string;
  position: Ch1Vec3;
  roles: readonly string[];
}

const sharedById = new Map<number, Ch1SharedNpcLiveAuditEntry>();
const addShared = (
  entityId: BiomesId,
  displayName: string,
  position: Ch1Vec3,
  role: string
) => {
  const prior = sharedById.get(Number(entityId));
  sharedById.set(Number(entityId), {
    entityId,
    displayName,
    position,
    roles: Object.freeze([...(prior?.roles ?? []), role]),
  });
};

for (const testimony of CH1_TESTIMONY_NPC_SEEDS) {
  addShared(
    testimony.entityId,
    testimony.displayName,
    testimony.position,
    "chapter1_testimony"
  );
}

for (const supplier of CH1_GROVE_SUPPLIER_ROUTE) {
  const npc = SNAPSHOT_GROVE_NPCS.find(
    (candidate) => candidate.displayName === supplier.label
  );
  if (!npc) throw new Error(`${supplier.label}: supplier NPC is missing`);
  addShared(
    snapshotGroveNpcEntityId(npc),
    npc.displayName,
    snapshotGroveGroundedPosition(npc.authoredPosition),
    "chapter1_supplier"
  );
}

for (const displayName of [
  "Billy",
  "Taye",
  "Luis",
  "Dimmi",
  "Doc",
  "Sil",
  "Kit the Courier",
  "Ranger Jane",
  "Rin the Forager",
]) {
  const npc = SNAPSHOT_GROVE_NPCS.find(
    (candidate) => candidate.displayName === displayName
  );
  if (!npc) throw new Error(`${displayName}: quest NPC is missing`);
  addShared(
    snapshotGroveNpcEntityId(npc),
    npc.displayName,
    snapshotGroveGroundedPosition(npc.authoredPosition),
    displayName === "Billy" ? "road_ahead" : "chapter1_quest_giver"
  );
}

addShared(
  SNAPSHOT_GROVE_JACKIE_ENTITY_ID,
  "Jackie",
  SNAPSHOT_GROVE_JACKIE_ORIGINAL_SPAWN_POSITION,
  "road_ahead"
);

export const CH1_SHARED_NPC_LIVE_AUDIT_ENTRIES: readonly Ch1SharedNpcLiveAuditEntry[] =
  Object.freeze([...sharedById.values()]);

export function ch1NpcLiveAuditCatalog() {
  return {
    version: CH1_NPC_LIVE_AUDIT_VERSION,
    scenarios: CH1_NPC_LIVE_AUDIT_SCENARIOS.map((scenario) => ({
      ...scenario,
      staging: ch1NpcLiveAuditStaging(scenario.input).map((row) => ({
        ...row,
        visualRoute: ch1CastVisualForEntity(row.entityId)?.route,
      })),
    })),
    sharedNpcs: CH1_SHARED_NPC_LIVE_AUDIT_ENTRIES,
    returningNpc: CH1_SERGEANT_HOLT,
  };
}
