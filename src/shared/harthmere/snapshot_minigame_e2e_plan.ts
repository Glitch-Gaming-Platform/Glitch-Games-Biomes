import {
  SNAPSHOT_MINIGAME_CATALOG,
  SNAPSHOT_MINIGAME_QUEST_BINDINGS,
} from "@/shared/harthmere/snapshot_minigame_catalog";
import type { MinigameType } from "@/shared/ecs/gen/types";
import type { BiomesId } from "@/shared/ids";

export type SnapshotMinigameE2EPhase =
  | "authoritative_catalog"
  | "browser_hydration"
  | "join"
  | "race_start"
  | "race_checkpoints"
  | "race_finish"
  | "physical_leaderboard"
  | "multiplayer_join"
  | "waiting_for_players"
  | "round_countdown"
  | "round_playing"
  | "space_clipboard_restore"
  | "shared_loadout"
  | "round_finish"
  | "finished_instance_hidden"
  | "quest_finish_event";

export interface SnapshotMinigameE2EPlanRow {
  readonly id: BiomesId;
  readonly kind: MinigameType;
  readonly label: string;
  readonly snapshotReady: boolean;
  readonly renderedBrowserSessions: 1 | 2;
  readonly requiredParticipants: 1 | 2 | 3;
  readonly additionalBrowserSessions: 0 | 1;
  readonly questBound: boolean;
  readonly phases: readonly SnapshotMinigameE2EPhase[];
}

// The original Spleef setting stores the number of *additional* players.
// Almost every snapshot arena stores 0 or 1, but 20x20 Spleef stores 2 and
// therefore needs a third authenticated participant. Keep only two rendered
// WebGL sessions and open the third low-memory session for that one row.
const SPLEEF_REQUIRED_PARTICIPANT_OVERRIDES = new Map<BiomesId, 2 | 3>([
  [5091744724459687 as BiomesId, 3],
  [6691830155527336 as BiomesId, 2],
]);

const questBoundIds = new Set(
  SNAPSHOT_MINIGAME_QUEST_BINDINGS.map((binding) => binding.minigameId)
);

function phasesFor(
  kind: MinigameType,
  questBound: boolean
): readonly SnapshotMinigameE2EPhase[] {
  const common: SnapshotMinigameE2EPhase[] = [
    "authoritative_catalog",
    "browser_hydration",
    "join",
  ];
  switch (kind) {
    case "simple_race":
      return [
        ...common,
        "race_start",
        "race_checkpoints",
        "race_finish",
        "physical_leaderboard",
        ...(questBound ? (["quest_finish_event"] as const) : []),
      ];
    case "spleef":
      return [
        ...common,
        "multiplayer_join",
        "waiting_for_players",
        "round_countdown",
        "round_playing",
        "space_clipboard_restore",
        "round_finish",
      ];
    case "deathmatch":
      return [
        ...common,
        "multiplayer_join",
        "waiting_for_players",
        "round_countdown",
        "round_playing",
        "shared_loadout",
        "round_finish",
        "finished_instance_hidden",
      ];
  }
}

export const SNAPSHOT_MINIGAME_E2E_PLAN = SNAPSHOT_MINIGAME_CATALOG.map(
  (entry): SnapshotMinigameE2EPlanRow => {
    const questBound = questBoundIds.has(entry.id);
    const requiredParticipants =
      entry.kind === "simple_race"
        ? 1
        : entry.kind === "deathmatch"
          ? 2
          : (SPLEEF_REQUIRED_PARTICIPANT_OVERRIDES.get(entry.id) ?? 2);
    const renderedBrowserSessions = requiredParticipants === 1 ? 1 : 2;
    return {
      id: entry.id,
      kind: entry.kind,
      label: entry.label?.trim() || `${entry.kind} ${entry.id}`,
      snapshotReady: entry.snapshotReady,
      renderedBrowserSessions,
      requiredParticipants,
      additionalBrowserSessions:
        requiredParticipants > renderedBrowserSessions ? 1 : 0,
      questBound,
      phases: phasesFor(entry.kind, questBound),
    };
  }
);

export function snapshotMinigameE2EPlanForKinds(
  kinds: ReadonlySet<MinigameType>
) {
  return SNAPSHOT_MINIGAME_E2E_PLAN.filter((row) => kinds.has(row.kind));
}
