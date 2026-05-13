import {
  HARTHMERE_MISSION_EVENTS_KEY,
  QUESTS,
  QUEST_TARGETS,
  readHarthmereQuestState,
  writeHarthmereQuestState,
  type HarthmereQuestDefinition,
  type HarthmereQuestState,
} from "@/client/components/challenges/LocalDevHarthmereQuests";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { useEffect, useMemo, useState } from "react";

type MissionStatus =
  | "Available"
  | "Accepted"
  | "In Progress"
  | "Ready to Turn In"
  | "Completed"
  | "Abandoned"
  | "Blocked";

type MissionKind =
  | "Main Story"
  | "Side Quest"
  | "Daily"
  | "Profession"
  | "Bounty"
  | "Investigation"
  | "Delivery"
  | "Town Service";

type MissionDifficulty = "Easy" | "Normal" | "Hard" | "Stealth" | "Mystery";

type MissionEvent = {
  at: number;
  kind: string;
  title: string;
  detail: string;
};

type TrackedMission = {
  quest: HarthmereQuestDefinition;
  status: MissionStatus;
  kind: MissionKind;
  level: number;
  difficulty: MissionDifficulty;
  stepIndex?: number;
  objective: string;
  hint: string;
  progressLabel: string;
  markerLabel: string;
  markerType: "exact" | "search_area" | "turn_in" | "quest_giver";
  rewardPreview: string;
  distance: number;
  direction: string;
};

const HARTHMERE_TRACKED_MISSIONS_KEY =
  "biomes.localDev.harthmere.trackedMissions.v1";

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function readMissionEvents(): MissionEvent[] {
  if (!isBrowser()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_MISSION_EVENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as MissionEvent[]) : [];
    return parsed.filter((event) => event.title && event.detail).slice(0, 12);
  } catch {
    return [];
  }
}

function recordMissionEvent(kind: string, title: string, detail: string) {
  if (!isBrowser()) {
    return;
  }
  const next = [
    { at: Date.now(), kind, title, detail },
    ...readMissionEvents(),
  ].slice(0, 12);
  window.localStorage.setItem(
    HARTHMERE_MISSION_EVENTS_KEY,
    JSON.stringify(next),
  );
  window.dispatchEvent(new Event("biomes:harthmere-mission-event"));
}

function readTrackedMissionIds(): string[] {
  if (!isBrowser()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_TRACKED_MISSIONS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeTrackedMissionIds(ids: string[]) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    HARTHMERE_TRACKED_MISSIONS_KEY,
    JSON.stringify([...new Set(ids)]),
  );
  window.dispatchEvent(new Event("biomes:harthmere-mission-tracking-changed"));
}

function missionKind(quest: HarthmereQuestDefinition): MissionKind {
  if (quest.id === "welcome-to-harthmere" || quest.id === "the-missing-bell") {
    return "Main Story";
  }
  if (quest.id === "cold-iron-hot-temper") {
    return "Profession";
  }
  if (quest.id === "whispering-crate" || quest.id === "missing-lockbox") {
    return "Investigation";
  }
  if (quest.id === "fever-tea" || quest.id === "apples-for-dawnloaf") {
    return "Delivery";
  }
  if (quest.repeatable) {
    return "Daily";
  }
  return "Side Quest";
}

function missionLevel(quest: HarthmereQuestDefinition): number {
  if (quest.id === "the-missing-bell") {
    return 5;
  }
  if (quest.id === "whispering-crate") {
    return 4;
  }
  if (quest.id === "missing-lockbox" || quest.id === "fever-tea") {
    return 3;
  }
  return quest.id === "welcome-to-harthmere" ? 1 : 2;
}

function missionDifficulty(quest: HarthmereQuestDefinition): MissionDifficulty {
  if (quest.id === "the-missing-bell" || quest.id === "whispering-crate") {
    return "Mystery";
  }
  if (quest.id === "missing-lockbox") {
    return "Stealth";
  }
  if (quest.id === "cold-iron-hot-temper") {
    return "Normal";
  }
  return "Easy";
}

function markerType(
  quest: HarthmereQuestDefinition,
  status: MissionStatus,
  stepIndex?: number,
): TrackedMission["markerType"] {
  if (status === "Ready to Turn In") {
    return "turn_in";
  }
  if (status === "Available") {
    return "quest_giver";
  }
  if (
    quest.id === "the-missing-bell" ||
    quest.id === "whispering-crate" ||
    quest.steps[stepIndex ?? 0]?.objective.toLowerCase().includes("search") ||
    quest.steps[stepIndex ?? 0]?.objective.toLowerCase().includes("inspect")
  ) {
    return "search_area";
  }
  return "exact";
}

function compassDirection(dx: number, dz: number) {
  const absX = Math.abs(dx);
  const absZ = Math.abs(dz);
  if (absX < 4 && absZ < 4) {
    return "here";
  }
  const eastWest = dx > 0 ? "east" : "west";
  const northSouth = dz > 0 ? "south" : "north";
  if (absX > absZ * 1.7) {
    return eastWest;
  }
  if (absZ > absX * 1.7) {
    return northSouth;
  }
  return `${northSouth}-${eastWest}`;
}

function defaultHint(quest: HarthmereQuestDefinition, stepIndex: number) {
  const objective = quest.steps[stepIndex]?.objective ?? quest.summary;
  if (quest.id === "welcome-to-harthmere") {
    return "Follow the safe onboarding route through the gate, market, services, chapel, and guard yard.";
  }
  if (quest.id === "the-missing-bell") {
    return "Treat this as a mystery. Follow chapel, well, Mudden Ward, and Underways clues in order.";
  }
  if (objective.toLowerCase().includes("return")) {
    return "The objective is ready to hand back to the named NPC. Follow the turn-in marker.";
  }
  return quest.summary;
}

function availableQuests(state: HarthmereQuestState) {
  return QUESTS.filter(
    (quest) =>
      state.active[quest.id] === undefined &&
      !state.completed.includes(quest.id),
  );
}

function questStatus(
  quest: HarthmereQuestDefinition,
  state: HarthmereQuestState,
): MissionStatus {
  if (state.completed.includes(quest.id)) {
    return "Completed";
  }
  const stepIndex = state.active[quest.id];
  if (stepIndex !== undefined) {
    return stepIndex >= quest.steps.length - 1
      ? "Ready to Turn In"
      : "In Progress";
  }
  return "Available";
}

function buildMission(
  quest: HarthmereQuestDefinition,
  state: HarthmereQuestState,
  playerPos: [number, number, number],
): TrackedMission {
  const status = questStatus(quest, state);
  const rawStepIndex = state.active[quest.id];
  const stepIndex = rawStepIndex ?? 0;
  const step = quest.steps[stepIndex] ?? quest.steps[0];
  const targetOffset =
    status === "Available"
      ? (quest.giverOffsets.find((offset) => QUEST_TARGETS[offset]) ?? 41)
      : (step?.targetOffset ?? 41);
  const target = QUEST_TARGETS[targetOffset] ?? QUEST_TARGETS[41];
  const dx = target.pos[0] - playerPos[0];
  const dz = target.pos[2] - playerPos[2];
  const distance = Math.round(Math.hypot(dx, dz));
  const finalStep =
    rawStepIndex !== undefined && rawStepIndex >= quest.steps.length - 1;

  return {
    quest,
    status,
    kind: missionKind(quest),
    level: missionLevel(quest),
    difficulty: missionDifficulty(quest),
    stepIndex: rawStepIndex,
    objective:
      status === "Completed"
        ? "Completed. Check the journal for the outcome and rewards earned."
        : (step?.objective ?? quest.summary),
    hint: defaultHint(quest, stepIndex),
    progressLabel:
      status === "Completed"
        ? "Completed"
        : rawStepIndex !== undefined
          ? `Stage ${stepIndex + 1} / ${quest.steps.length}`
          : "Not accepted",
    markerLabel: target.label,
    markerType: markerType(
      quest,
      finalStep ? "Ready to Turn In" : status,
      stepIndex,
    ),
    rewardPreview: quest.reward,
    distance,
    direction: compassDirection(dx, dz),
  };
}

function useMissionState() {
  const [state, setState] = useState<HarthmereQuestState>(() =>
    readHarthmereQuestState(),
  );
  const [events, setEvents] = useState<MissionEvent[]>(() =>
    readMissionEvents(),
  );
  const [trackedIds, setTrackedIds] = useState<string[]>(() =>
    readTrackedMissionIds(),
  );

  useEffect(() => {
    const refresh = () => {
      setState(readHarthmereQuestState());
      setEvents(readMissionEvents());
      setTrackedIds(readTrackedMissionIds());
    };
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    window.addEventListener("biomes:harthmere-quest-state-changed", refresh);
    window.addEventListener("biomes:harthmere-mission-event", refresh);
    window.addEventListener(
      "biomes:harthmere-mission-tracking-changed",
      refresh,
    );
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(
        "biomes:harthmere-quest-state-changed",
        refresh,
      );
      window.removeEventListener("biomes:harthmere-mission-event", refresh);
      window.removeEventListener(
        "biomes:harthmere-mission-tracking-changed",
        refresh,
      );
    };
  }, []);

  return { state, events, trackedIds };
}

function useMissions() {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const { state, events, trackedIds } = useMissionState();
  const playerPos = localPlayer.player.position as [number, number, number];

  return useMemo(() => {
    const missions = QUESTS.map((quest) =>
      buildMission(quest, state, playerPos),
    );
    const active = missions.filter(
      (mission) =>
        mission.status === "In Progress" ||
        mission.status === "Ready to Turn In",
    );
    const tracked = active
      .filter((mission) => trackedIds.includes(mission.quest.id))
      .sort((a, b) => a.distance - b.distance);
    const untracked = active
      .filter((mission) => !trackedIds.includes(mission.quest.id))
      .sort((a, b) => a.distance - b.distance);
    const nearby = availableQuests(state)
      .map((quest) => buildMission(quest, state, playerPos))
      .sort((a, b) => a.distance - b.distance);
    const completed = missions.filter(
      (mission) => mission.status === "Completed",
    );
    const ready = active.filter(
      (mission) => mission.status === "Ready to Turn In",
    );
    const recommended =
      active.sort((a, b) => a.distance - b.distance)[0] ??
      nearby[0] ??
      missions[0];

    return {
      missions,
      active: [...tracked, ...untracked],
      nearby,
      completed,
      ready,
      recommended,
      events,
      trackedIds,
      state,
    };
  }, [events, playerPos, state, trackedIds]);
}

function statusTone(status: MissionStatus) {
  switch (status) {
    case "Ready to Turn In":
      return "text-yellow-200";
    case "Completed":
      return "text-emerald-200";
    case "Blocked":
      return "text-red-200";
    case "Available":
      return "text-blue-200";
    default:
      return "text-white/85";
  }
}

function missionIcon(mission: TrackedMission) {
  if (mission.status === "Ready to Turn In") {
    return "?";
  }
  if (mission.status === "Available") {
    return "!";
  }
  if (mission.markerType === "search_area") {
    return "◎";
  }
  return "◆";
}

function formatTimeAgo(at: number) {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  return `${Math.round(minutes / 60)}h ago`;
}

function trackMission(id: string) {
  writeTrackedMissionIds([...readTrackedMissionIds(), id]);
}

function untrackMission(id: string) {
  writeTrackedMissionIds(
    readTrackedMissionIds().filter((entry) => entry !== id),
  );
}

function abandonMission(quest: HarthmereQuestDefinition) {
  const state = readHarthmereQuestState();
  const active = { ...state.active };
  delete active[quest.id];
  writeHarthmereQuestState({ ...state, active });
  recordMissionEvent(
    "abandoned",
    quest.title,
    "Mission abandoned. It can be restarted from the original NPC or Market Board if still available.",
  );
}

const MissionLine: React.FunctionComponent<{
  mission: TrackedMission;
  compact?: boolean;
  tracked?: boolean;
  showActions?: boolean;
}> = ({ mission, compact, tracked, showActions }) => {
  return (
    <div className="rounded border border-white/10 bg-white/5 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-sm font-semibold text-white">
            <span className="text-yellow-200">{missionIcon(mission)}</span>
            <span className="truncate">{mission.quest.title}</span>
          </div>
          <div className="text-[10px] uppercase tracking-wide text-white/50">
            {mission.kind} · Level {mission.level} · {mission.difficulty}
          </div>
        </div>
        <div
          className={`shrink-0 text-xs font-semibold ${statusTone(mission.status)}`}
        >
          {mission.status}
        </div>
      </div>
      <div className="mt-1 text-xs leading-snug text-white/85">
        {mission.objective}
      </div>
      {!compact && (
        <>
          <div className="mt-1 text-[11px] leading-snug text-white/60">
            <span className="font-semibold text-white/75">Hint:</span>{" "}
            {mission.hint}
          </div>
          <div className="mt-1 text-[11px] leading-snug text-white/60">
            <span className="font-semibold text-white/75">Rewards:</span>{" "}
            {mission.rewardPreview}
          </div>
        </>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-white/65">
        <span>{mission.progressLabel}</span>
        <span>·</span>
        <span>{mission.markerType.replace("_", " ")}</span>
        <span>·</span>
        <span>
          {mission.markerLabel}, {mission.distance}m {mission.direction}
        </span>
      </div>
      {showActions && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tracked ? (
            <button
              className="rounded bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/20"
              onClick={() => untrackMission(mission.quest.id)}
            >
              Untrack
            </button>
          ) : (
            <button
              className="rounded bg-yellow-300/20 px-2 py-1 text-[11px] text-yellow-100 hover:bg-yellow-300/30"
              onClick={() => trackMission(mission.quest.id)}
            >
              Track
            </button>
          )}
          {(mission.status === "In Progress" ||
            mission.status === "Ready to Turn In") && (
            <button
              className="rounded bg-red-500/20 px-2 py-1 text-[11px] text-red-100 hover:bg-red-500/30"
              onClick={() => abandonMission(mission.quest)}
            >
              Abandon
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const HarthmereMissionTrackerHUD: React.FunctionComponent<{}> = () => {
  const { active, nearby, recommended, events } = useMissions();
  const visibleActive = active.slice(0, 4);
  const visibleNearby = nearby.slice(0, Math.max(0, 3 - visibleActive.length));
  const latest = events[0];

  return (
    <div
      className="pointer-events-none w-[21rem] rounded-lg border border-white/20 bg-black/75 p-2 text-white shadow-lg"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-yellow-200">
            Mission Tracker
          </div>
          <div className="text-xs text-white/70">
            {active.length
              ? `${active.length} active · ${nearby.length} nearby`
              : "No active missions yet"}
          </div>
        </div>
        {recommended && (
          <div className="rounded bg-yellow-300/20 px-1.5 py-0.5 text-xs font-semibold text-yellow-100">
            {recommended.distance}m {recommended.direction}
          </div>
        )}
      </div>

      <div className="space-y-1">
        {visibleActive.map((mission) => (
          <MissionLine key={mission.quest.id} mission={mission} compact />
        ))}
        {!visibleActive.length && (
          <div className="rounded border border-white/10 bg-white/5 p-2 text-xs leading-snug text-white/75">
            Go to the Market Board in the square to pick up a mission. Nearby
            jobs appear here when you enter their district.
          </div>
        )}
        {visibleNearby.map((mission) => (
          <div
            key={`nearby-${mission.quest.id}`}
            className="rounded border border-blue-300/20 bg-blue-300/10 p-2 text-xs leading-snug text-blue-50"
          >
            <span className="font-semibold">Nearby:</span> {mission.quest.title}{" "}
            · {mission.distance}m {mission.direction} at {mission.markerLabel}
          </div>
        ))}
      </div>

      {latest && (
        <div className="mt-2 rounded border border-emerald-300/20 bg-emerald-300/10 p-1.5 text-[11px] leading-snug text-emerald-50">
          <span className="font-semibold">Latest:</span> {latest.title} —{" "}
          {latest.detail}
        </div>
      )}
    </div>
  );
};

export const HarthmereMissionJournalPanel: React.FunctionComponent<{}> = () => {
  const { active, nearby, completed, ready, events, trackedIds } =
    useMissions();
  const [filter, setFilter] = useState<
    "dashboard" | "active" | "nearby" | "completed" | "guide"
  >("dashboard");
  const [search, setSearch] = useState("");

  const searchText = search.trim().toLowerCase();
  const filteredActive = active.filter((mission) =>
    `${mission.quest.title} ${mission.objective} ${mission.markerLabel}`
      .toLowerCase()
      .includes(searchText),
  );
  const filteredNearby = nearby.filter((mission) =>
    `${mission.quest.title} ${mission.quest.summary} ${mission.markerLabel}`
      .toLowerCase()
      .includes(searchText),
  );
  const filteredCompleted = completed.filter((mission) =>
    `${mission.quest.title} ${mission.quest.summary}`
      .toLowerCase()
      .includes(searchText),
  );

  return (
    <div className="mb-2 max-h-[78vh] w-[25rem] overflow-y-auto rounded-lg border border-white/15 bg-black/85 p-3 text-white shadow-xl">
      <div className="mb-2">
        <div className="text-base font-semibold text-yellow-200">
          Harthmere Mission Journal
        </div>
        <div className="text-xs leading-snug text-white/65">
          Tracks available work, active objectives, turn-ins, hints, rewards,
          mission status, and nearby opportunities.
        </div>
      </div>

      <div className="mb-2 grid grid-cols-5 gap-1 text-[11px]">
        {(["dashboard", "active", "nearby", "completed", "guide"] as const).map(
          (entry) => (
            <button
              key={entry}
              className={`rounded px-1.5 py-1 capitalize ${
                filter === entry
                  ? "bg-yellow-300 text-black"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              onClick={() => setFilter(entry)}
            >
              {entry}
            </button>
          ),
        )}
      </div>

      <input
        className="mb-2 w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-xs text-white placeholder:text-white/40"
        placeholder="Search quest title, NPC, location, or reward..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {filter === "dashboard" && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded bg-white/5 p-2">
              <div className="text-lg font-bold text-yellow-200">
                {active.length}
              </div>
              <div className="text-white/55">Active</div>
            </div>
            <div className="rounded bg-white/5 p-2">
              <div className="text-lg font-bold text-yellow-200">
                {ready.length}
              </div>
              <div className="text-white/55">Turn-ins</div>
            </div>
            <div className="rounded bg-white/5 p-2">
              <div className="text-lg font-bold text-yellow-200">
                {completed.length}
              </div>
              <div className="text-white/55">Completed</div>
            </div>
          </div>

          {ready.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-yellow-200">
                Ready to Turn In
              </div>
              <div className="space-y-1">
                {ready.map((mission) => (
                  <MissionLine
                    key={`ready-${mission.quest.id}`}
                    mission={mission}
                    compact
                    showActions
                    tracked={trackedIds.includes(mission.quest.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-yellow-200">
              Recommended Next
            </div>
            {(active[0] ?? nearby[0]) ? (
              <MissionLine
                mission={active[0] ?? nearby[0]}
                showActions
                tracked={trackedIds.includes((active[0] ?? nearby[0]).quest.id)}
              />
            ) : (
              <div className="rounded bg-white/5 p-2 text-xs text-white/70">
                All local-dev Harthmere missions are complete.
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-yellow-200">
              Recent Mission Updates
            </div>
            <div className="space-y-1">
              {events.length ? (
                events.slice(0, 5).map((event) => (
                  <div
                    key={`${event.at}-${event.title}`}
                    className="rounded bg-white/5 p-2 text-[11px] leading-snug text-white/70"
                  >
                    <div className="font-semibold text-white">
                      {event.title} · {formatTimeAgo(event.at)}
                    </div>
                    <div>{event.detail}</div>
                  </div>
                ))
              ) : (
                <div className="rounded bg-white/5 p-2 text-xs text-white/60">
                  Accept or complete a mission to see updates here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {filter === "active" && (
        <div className="space-y-2">
          {filteredActive.length ? (
            filteredActive.map((mission) => (
              <MissionLine
                key={mission.quest.id}
                mission={mission}
                showActions
                tracked={trackedIds.includes(mission.quest.id)}
              />
            ))
          ) : (
            <div className="rounded bg-white/5 p-2 text-xs text-white/70">
              No active missions match this search.
            </div>
          )}
        </div>
      )}

      {filter === "nearby" && (
        <div className="space-y-2">
          {filteredNearby.length ? (
            filteredNearby
              .slice(0, 12)
              .map((mission) => (
                <MissionLine
                  key={mission.quest.id}
                  mission={mission}
                  showActions
                  tracked={trackedIds.includes(mission.quest.id)}
                />
              ))
          ) : (
            <div className="rounded bg-white/5 p-2 text-xs text-white/70">
              No nearby available missions match this search.
            </div>
          )}
        </div>
      )}

      {filter === "completed" && (
        <div className="space-y-2">
          {filteredCompleted.length ? (
            filteredCompleted.map((mission) => (
              <MissionLine key={mission.quest.id} mission={mission} compact />
            ))
          ) : (
            <div className="rounded bg-white/5 p-2 text-xs text-white/70">
              No completed missions match this search.
            </div>
          )}
        </div>
      )}

      {filter === "guide" && (
        <div className="space-y-2 text-xs leading-snug text-white/75">
          <div className="rounded bg-white/5 p-2">
            <div className="font-semibold text-yellow-200">
              Mission Statuses
            </div>
            <div>
              Available means you can accept it. In Progress means follow the
              next objective. Ready to Turn In means return to the named NPC.
              Completed means rewards and consequences were already applied.
            </div>
          </div>
          <div className="rounded bg-white/5 p-2">
            <div className="font-semibold text-yellow-200">Map and Compass</div>
            <div>
              ! marks available work, ? marks turn-ins, ◎ marks a search area,
              and ◆ marks an exact objective. The tracker shows distance and
              cardinal direction from your current position.
            </div>
          </div>
          <div className="rounded bg-white/5 p-2">
            <div className="font-semibold text-yellow-200">
              Abandon / Restart
            </div>
            <div>
              Abandon removes the active objective but keeps completed history.
              Restart from the original quest giver or the Market Board when the
              job is still available.
            </div>
          </div>
          <div className="rounded bg-white/5 p-2">
            <div className="font-semibold text-yellow-200">
              Implementation Rule
            </div>
            <div>
              Each mission shows what to do, why it matters, where to go, how
              far away it is, what progress you have made, who receives the
              turn-in, and what reward or consequence follows.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
